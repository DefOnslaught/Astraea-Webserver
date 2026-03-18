import os, threading, logging, heapq, re
from datetime import datetime, timedelta
from django.core.cache import cache
from django.utils import timezone
from django.db import close_old_connections
from django.db.models import Q

from .models import Server
from .constants import SERVER_CACHE_FIELDS

logger = logging.getLogger('django')


def get_dashboard_stats():
    """Returns stats from cache, or calculates them if missing."""
    stats = cache.get("dashboard_stats")
    return stats if stats else refresh_dashboard_stats()

def _project_dashboard_fields(vm):
    """Returns only the specific fields required for the Dashboard UI."""
    return {
        "server_id": str(vm.get('server_id') if isinstance(vm, dict) else vm.server_id),
        "hostname": vm.get('hostname') if isinstance(vm, dict) else vm.hostname,
        "ip_address": vm.get('ip_address') if isinstance(vm, dict) else vm.ip_address,
        "last_patch_date": vm.get('last_patch_date') if isinstance(vm, dict) else vm.last_patch_date,
    }

def refresh_dashboard_stats(vms=None):
    """Calculates summary stats and top server lists. Hits DB only if vms is None."""
    days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
    time_threshold = timezone.now() - timedelta(days=days)

    if vms is None:
        # DB Fallback (try to avoid this on the home page)
        vms = list(Server.objects.all().values('id', 'server_id','hostname', 'ip_address', 'last_patch_date', 'os_version', 'last_reboot', 'env'))

    total_servers = len(vms)
    total_servers_not_enabled = 0
    outdated_count = 0

    for vm in vms:
        lp_date = vm.get('last_patch_date')
        enabled = vm.get('enable_patching')
        if lp_date is None or lp_date < time_threshold:
            outdated_count += 1
        if enabled == False:
            total_servers_not_enabled += 1

    # Define a 'zero' time for comparison
    epoch_start = timezone.make_aware(datetime(1970, 1, 1))

    # 1. Get only the ones that are actually "outdated"
    outdated_vms = [v for v in vms if v.get('last_patch_date') is None or v.get('last_patch_date') < time_threshold]

    # 2. Pick the 5 oldest from THAT filtered list
    at_risk_raw = heapq.nsmallest(
        5, outdated_vms, 
        key=lambda x: x.get('last_patch_date') if x.get('last_patch_date') else epoch_start
    )

    # Recent Activity: We want the LARGEST dates (newest).
    # We filter out None because a 'never patched' server is not 'recent activity'.
    patched_vms = [v for v in vms if v.get('last_patch_date') is not None]
    recent_raw = heapq.nlargest(
        5, patched_vms, 
        key=lambda x: x.get('last_patch_date')
    )

    stats = {
        "total_servers": total_servers,
        "total_servers_not_enabled": total_servers_not_enabled,
        "outdated_servers": outdated_count,
        "at_risk": [_project_dashboard_fields(v) for v in at_risk_raw],
        "recent_activity": [_project_dashboard_fields(v) for v in recent_raw],
        "last_updated": timezone.now().isoformat()
    }
    
    cache.set("dashboard_stats", stats, timeout=None)
    logger.info(f"Cache has been successfully set for 'dashboard_stats'")
    return stats


def update_dashboard_counts(instance, was_outdated, is_outdated, was_enabled=True, is_new=False, is_deleted=False):
    stats = cache.get("dashboard_stats")
    if not stats:
        return refresh_dashboard_stats()
    
    if "total_servers_not_enabled" not in stats:
        stats["total_servers_not_enabled"] = 0

    # Convert the model instance to a dict that matches your list format
    vm_dict = {
        'server_id': str(instance.server_id),
        'hostname': instance.hostname,
        'ip_address': instance.ip_address,
        'last_patch_date': instance.last_patch_date,
        'total_servers_not_enabled': instance.enable_patching,
    }

    # 1. Handle Totals
    if is_new:
        stats["total_servers"] += 1
        if instance.enable_patching == False:
            stats["total_servers_not_enabled"] += 1
    elif is_deleted:
        stats["total_servers"] -= 1
        if instance.enable_patching == False:
            stats["total_servers_not_enabled"] = max(0, stats["total_servers_not_enabled"] - 1)
    else:
        if was_enabled and not instance.enable_patching:
            stats["total_servers_not_enabled"] += 1
        elif not was_enabled and instance.enable_patching:
            stats["total_servers_not_enabled"] = max(0, stats["total_servers_not_enabled"] - 1)

    if was_outdated and not is_outdated:
        stats["outdated_servers"] = max(0, stats["outdated_servers"] - 1)
    elif not was_outdated and is_outdated:
        stats["outdated_servers"] += 1

    # 2. Handle Recent Activity List
    if not is_deleted and instance.last_patch_date:
        # Remove if already exists (to avoid duplicates), then add to top
        stats["recent_activity"] = [v for v in stats.get("recent_activity", []) if v['server_id'] != instance.server_id]
        stats["recent_activity"].insert(0, vm_dict)
        # Keep only top 5
        stats["recent_activity"] = sorted(
            stats["recent_activity"], 
            key=lambda x: x['last_patch_date'], 
            reverse=True
        )[:5]

    # 3. Handle At Risk List
    if not is_deleted:
        # Remove existing instance to update it
        current_at_risk = [v for v in stats.get("at_risk", []) if v['server_id'] != instance.server_id]
        
        # ONLY add it back if it is actually outdated
        if is_outdated:
            current_at_risk.append(vm_dict)
        
        epoch_start = timezone.make_aware(datetime(1970, 1, 1))
        stats["at_risk"] = sorted(
            current_at_risk, 
            key=lambda x: x['last_patch_date'] if x['last_patch_date'] else epoch_start
        )[:5]
    else:
        # If deleted, just remove from lists
        stats["recent_activity"] = [v for v in stats.get("recent_activity", []) if v['server_id'] != instance.server_id]
        stats["at_risk"] = [v for v in stats.get("at_risk", []) if v['server_id'] != instance.server_id]

    stats["last_updated"] = timezone.now().isoformat()
    cache.set("dashboard_stats", stats, timeout=None)
    logger.info(f"Cache has been successfully updated for 'dashboard_stats'")
    return stats


def cache_individual_vms(vms):
    """Updates specific Redis entries and surgically updates the search index."""
    payload = {}
    
    # 1. Fetch the existing search index
    current_index = cache.get("server_search_index")
    
    # If index is missing, we can't update it surgically. 
    # Just trigger a full warm and update individual server keys.
    if current_index is None:
        current_index = [] 

    # Convert index to a dict for O(1) lookups during the update
    # Using 'server_id' as the unique key
    index_map = {str(item['server_id']): item for item in current_index}

    for vm in vms:
        server_id = str(getattr(vm, 'server_id') if hasattr(vm, 'server_id') else vm.get('server_id'))
        
        def get_val(attr, default=None):
            return getattr(vm, attr) if hasattr(vm, attr) else vm.get(attr, default)

        # Helper to ensure dates are consistently ISO 8601 formatted
        def format_date(date_val):
            if not date_val:
                return None
            # If it's already a string, return as is (assuming it's already formatted)
            if isinstance(date_val, str):
                return date_val
            # If it's a datetime object, use isoformat()
            if hasattr(date_val, 'isoformat'):
                return date_val.isoformat()
            return str(date_val)

        server_obj = {
            "server_id": server_id,
            "hostname": get_val('hostname', 'Unknown'),
            "ip_address": get_val('ip_address', '0.0.0.0'),
            "mac_address": get_val('mac_address', ''),
            "os_version": get_val('os_version', 'Unknown'),
            "last_reboot": format_date(get_val('last_reboot')),
            "uptime": get_val('uptime', ''),
            "env": get_val('env', ''),
            "patch_schedule": get_val('patch_schedule'),
            "last_patch": format_date(get_val('last_patch_date')),
            "enable_patching": get_val('enable_patching', True),
            "total_packages_updated": get_val('total_packages_updated', '')
        }

        # 2. Update individual granular keys
        payload[f"server_data:{server_id}"] = server_obj
        
        # 3. Update the dictionary map for the index
        index_map[str(server_id)] = server_obj

    # 4. Save everything back
    if payload:
        cache.set_many(payload, timeout=None)
        
        # Convert map back to list and sort by hostname to keep search results consistent
        updated_index = sorted(index_map.values(), key=lambda x: natural_sort_key(x['hostname']))
        cache.set("server_search_index", updated_index, timeout=None)


def remove_vm_from_index(server_id):
    """Surgically removes a server from the search index list."""
    current_index = cache.get("server_search_index")
    if not current_index:
        return
    
    # Filter out the deleted ID
    updated_index = [vm for vm in current_index if str(vm['server_id']) != str(server_id)]
    
    if len(updated_index) != len(current_index):
        cache.set("server_search_index", updated_index, timeout=None)


def warm_cache_in_background():
    """
    Checks if warming is already in progress. If not, starts a 
    background thread to populate Redis.
    """
    if cache.get("is_warming"):
        return 
    
    def task():
        logger.info("Background cache starting.")
        close_old_connections()
        cache.set("is_warming", True, timeout=300)
        try:
            vms = list(Server.objects.values(*SERVER_CACHE_FIELDS))
            cache_individual_vms(vms)
            refresh_dashboard_stats(vms=vms)
            logger.info("Background cache warming completed.")
        except Exception as e:
            logger.error(f"Background cache warm failed: {e}")
        finally:
            cache.delete("is_warming")
            close_old_connections()
    
    threading.Thread(target=task, daemon=True).start()


def parse_relative_date(date_str):
    """
    Converts strings like '30d', '7d', '2w', '1y' into a datetime object.
    """
    match = re.match(r'(\d+)([dwmy])', date_str.lower())
    if not match:
        return None
    
    amount, unit = int(match.group(1)), match.group(2)
    now = timezone.now()
    
    if unit == 'd': return now - timedelta(days=amount)
    if unit == 'w': return now - timedelta(weeks=amount)
    if unit == 'm': return now - timedelta(days=amount * 30)
    if unit == 'y': return now - timedelta(days=amount * 365)
    return None


def evaluate_comparison(data_val, search_val):
    """
    Evaluates comparisons like '>30d', '<7d', or 'none'.
    Handles both dates and numeric values.
    """
    if not data_val:
        return search_val.lower() == 'none'
    
    # Check for operators at the start of the search value
    op_match = re.match(r'([><=]=?)(.*)', str(search_val))
    
    if op_match:
        op, val_str = op_match.groups()
        
        # Determine if we are comparing dates or numbers
        target_date = parse_relative_date(val_str)
        
        # If data_val is a string timestamp from cache, convert it
        current_val = data_val
        if isinstance(data_val, str):
            try:
                current_val = datetime.fromisoformat(data_val)
                if timezone.is_naive(current_val):
                    current_val = timezone.make_aware(current_val)
            except ValueError:
                pass

        # Perform logic
        if op == '>': return current_val < target_date if target_date else False
        if op == '<': return current_val > target_date if target_date else False
        if op == '>=': return current_val >= target_date
        if op == '<=': return current_val <= target_date
        if op == '==': return current_val == target_date
        
    # Fallback to standard string inclusion if no operator found
    return str(search_val).lower() in str(data_val).lower()


def natural_sort_key(s):
    """
    Splits string into a list of strings and integers.
    'server-10.internal' -> ['server-', 10, '.internal']
    """
    return [int(text) if text.isdigit() else text.lower()
            for text in re.split('([0-9]+)', s)]