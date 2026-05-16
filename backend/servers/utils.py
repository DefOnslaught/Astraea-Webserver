import os, threading, logging, heapq, re
from datetime import datetime, timedelta
from django.core.cache import cache
from django.utils import timezone
from django.db import close_old_connections
from django.db.models import Max, Q

from backend.settings import DEBUG
from .models import Server, PatchSession, PackageUpdate

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
        "last_patch_date": vm.get('last_patch_date') if isinstance(vm, dict) else vm.last_patch_date,
        "total_servers_not_enabled": vm.get('enable_patching') if isinstance(vm, dict) else vm.enable_patching,
    }

def refresh_dashboard_stats(vms=None):
    """Calculates summary stats and top server lists. Hits DB only if vms is None."""
    days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
    time_threshold = timezone.now() - timedelta(days=days)

    if vms is None:
        # DB Fallback (try to avoid this on the home page)
        vms = list(Server.objects.prefetch_related('interfaces').all())

    def get_val(obj, attr, default=None):
        """Helper to fetch attribute from either a Model instance or a Dictionary."""
        if isinstance(obj, dict):
            return obj.get(attr, default)
        return getattr(obj, attr, default)

    total_servers = len(vms)
    total_servers_not_enabled = 0
    outdated_count = 0

    for vm in vms:
        lp_date = get_val(vm, 'last_patch_date')
        enabled = get_val(vm, 'enable_patching')
        
        if lp_date is None or lp_date < time_threshold:
            outdated_count += 1
        if enabled is False:
            total_servers_not_enabled += 1

    # Define a 'zero' time for comparison
    epoch_start = timezone.make_aware(datetime(1970, 1, 1))

    # 1. Get only the ones that are actually "outdated"
    outdated_vms = [v for v in vms if get_val(v, 'last_patch_date') is None or get_val(v, 'last_patch_date') < time_threshold]

    # 2. Pick the 5 oldest from THAT filtered list
    at_risk_raw = heapq.nsmallest(
        5, outdated_vms, 
        key=lambda x: get_val(x, 'last_patch_date') if get_val(x, 'last_patch_date') else epoch_start
    )

    # Recent Activity: We want the LARGEST dates (newest).
    # We filter out None because a 'never patched' server is not 'recent activity'.
    patched_vms = [v for v in vms if get_val(v, 'last_patch_date') is not None]
    recent_raw = heapq.nlargest(
        5, patched_vms, 
        key=lambda x: get_val(x, 'last_patch_date')
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
    if DEBUG:
        if cache.get("dashboard_stats"):
            logger.info(f"Cache has been successfully set for 'refresh_dashboard_stats'")
        else:
            logger.error(f"Cache has failed for 'refresh_dashboard_stats'")
    return stats


def update_dashboard_counts(instance, was_outdated, is_outdated, was_enabled=True, is_new=False, is_deleted=False):
    stats = cache.get("dashboard_stats")
    if not stats or "total_servers" not in stats:
        return refresh_dashboard_stats()
    
    if "total_servers_not_enabled" not in stats:
        stats["total_servers_not_enabled"] = 0

    # Convert the model instance to a dict that matches your list format
    vm_projection = {
        'server_id': str(instance.server_id),
        'hostname': instance.hostname,
        'last_patch_date': instance.last_patch_date.isoformat() if instance.last_patch_date else None,
        'total_servers_not_enabled': instance.enable_patching,
    }

    # Helper for sorting
    def parse_date(d_str):
        if not d_str: return epoch_start
        if isinstance(d_str, datetime): return d_str
        return datetime.fromisoformat(d_str)

    epoch_start = timezone.make_aware(datetime(1970, 1, 1))

    # 1. Update Totals
    if is_new:
        stats["total_servers"] += 1
        if not instance.enable_patching:
            stats["total_servers_not_enabled"] += 1
    elif is_deleted:
        stats["total_servers"] = max(0, stats["total_servers"] - 1)
        if not instance.enable_patching:
            stats["total_servers_not_enabled"] = max(0, stats["total_servers_not_enabled"] - 1)
    else:
        # Handle toggle of enable_patching
        if was_enabled and not instance.enable_patching:
            stats["total_servers_not_enabled"] += 1
        elif not was_enabled and instance.enable_patching:
            stats["total_servers_not_enabled"] = max(0, stats["total_servers_not_enabled"] - 1)

    # Handle Outdated counter
    if was_outdated and not is_outdated:
        stats["outdated_servers"] = max(0, stats["outdated_servers"] - 1)
    elif not was_outdated and is_outdated:
        stats["outdated_servers"] += 1

    # 2. Update Recent Activity and At Risk lists
    stats["recent_activity"] = [v for v in stats.get("recent_activity", []) if v['server_id'] != str(instance.server_id)]
    stats["at_risk"] = [v for v in stats.get("at_risk", []) if v['server_id'] != str(instance.server_id)]

    if not is_deleted:
        # If patched recently, add to recent
        if instance.last_patch_date:
            stats["recent_activity"].insert(0, vm_projection)
            # Re-sort to ensure correctness after a manual update
            stats["recent_activity"].sort(key=lambda x: parse_date(x['last_patch_date']), reverse=True)
            stats["recent_activity"] = stats["recent_activity"][:5]

        # If currently outdated, add to at_risk
        if is_outdated:
            stats["at_risk"].append(vm_projection)
            stats["at_risk"].sort(key=lambda x: parse_date(x['last_patch_date']))
            stats["at_risk"] = stats["at_risk"][:5]

    threshold = timezone.now() - timedelta(days=int(os.getenv("PATCH_THRESHOLD_DAYS", 30)))

    if len(stats["at_risk"]) < 5 and stats["outdated_servers"] > len(stats["at_risk"]):
        replacements = Server.objects.filter(
            Q(last_patch_date__lt=threshold) | Q(last_patch_date__isnull=True)
        ).order_by('last_patch_date')[:5]
        stats["at_risk"] = [_project_dashboard_fields(v) for v in replacements]

    if len(stats["recent_activity"]) < 5:
        replacements = Server.objects.filter(
            last_patch_date__isnull=False
        ).order_by('-last_patch_date')[:5]
        stats["recent_activity"] = [_project_dashboard_fields(v) for v in replacements]

    stats["last_updated"] = timezone.now().isoformat()
    cache.set("dashboard_stats", stats, timeout=None)
    
    if DEBUG:
        if cache.get("dashboard_stats"):
            logger.info(f"Cache has been successfully set for 'update_dashboard_counts'")
        else:
            logger.error(f"Cache has failed for 'update_dashboard_counts'")
            
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
        
        # Interface logic
        structured_interfaces = []
        if isinstance(vm, Server):
            # Map the actual model objects to a list of dicts
            for i in vm.interfaces.all():
                structured_interfaces.append({
                    "name": i.interface_name or "Unknown",
                    "ip": i.ip_address,
                    "mac": i.mac_address or "N/A"
                })
        elif isinstance(vm, dict):
            # Fallback if processing raw dictionary data
            structured_interfaces = vm.get('interfaces', [])
        
        # Determine last known status
        last_status = "Unknown" 
        if isinstance(vm, Server):
            latest_session = vm.patch_sessions.only('status').first()
            if latest_session:
                last_status = latest_session.status

        # Create the comma-separated strings for high-level overview/search
        ip_list = [iface['ip'] for iface in structured_interfaces]
        mac_list = [iface['mac'] for iface in structured_interfaces]

        server_obj = {
            "server_id": server_id,
            "hostname": get_val('hostname', 'Unknown'),
            "ip_address": ", ".join(ip_list),
            "mac_address": ", ".join(mac_list),
            "interfaces": structured_interfaces, 
            "os_version": get_val('os_version', 'Unknown'),
            "last_reboot": format_date(get_val('last_reboot')),
            "uptime": get_val('uptime', ''),
            "env": get_val('env', ''),
            "patch_schedule": get_val('patch_schedule'),
            "last_patch": format_date(get_val('last_patch_date')),
            "last_patch_status": last_status,
            "enable_patching": get_val('enable_patching', True),
            "total_packages_updated": get_val('total_packages_updated', ''),
            "date_registered": format_date(get_val('date_registered')),
            "enable_notifications": get_val('enable_notifications', True)
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
    
        if DEBUG:
            if cache.get("server_search_index"):
                logger.info(f"Cache has been successfully set for 'cache_individual_vms'")
            else:
                logger.error(f"Cache has failed for 'cache_individual_vms'")


def remove_vm_from_index(server_id):
    """Surgically removes a server from the search index list."""
    current_index = cache.get("server_search_index")
    if not current_index:
        return
    
    # Filter out the deleted ID
    updated_index = [vm for vm in current_index if str(vm['server_id']) != str(server_id)]
    
    if len(updated_index) != len(current_index):
        cache.set("server_search_index", updated_index, timeout=None)
        if DEBUG:
            logger.info(f"Server with ID {server_id} was removed from the cache successfully.")


def refresh_package_search_index():
    """
    Lean aggregation for the searchable index. 
    Excludes server lists to maximize performance.
    """
    latest_session_ids = PatchSession.objects.filter(status='success') \
        .values('server') \
        .annotate(latest_id=Max('id')) \
        .values_list('latest_id', flat=True)

    # We only need the package details and the count
    active_updates = PackageUpdate.objects.filter(session_id__in=latest_session_ids) \
        .select_related('package')

    grouped_map = {}
    for update in active_updates:
        pkg = update.package
        
        if pkg.name not in grouped_map:
            grouped_map[pkg.name] = {
                "name": pkg.name,
                "versions": {},
                "search_stack": pkg.name.lower()
            }
        
        name_entry = grouped_map[pkg.name]
        if pkg.version not in name_entry["versions"]:
            name_entry["versions"][pkg.version] = 0
        
        name_entry["versions"][pkg.version] += 1

    final_index = []
    for pkg_name, data in grouped_map.items():
        # Convert versions to a sorted list of dicts: [{"v": "1.0", "count": 5}, ...]
        sorted_versions = [
            {"version": v, "count": c} 
            for v, c in sorted(data["versions"].items(), reverse=True)
        ]
        data["versions"] = sorted_versions
        final_index.append(data)

    final_index = sorted(final_index, key=lambda x: x['name'])
    cache.set("package_search_index", final_index, timeout=None)
    if DEBUG:
        logger.info(f"Successfully set cache for 'Package Search Index'")
    return final_index


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
            vms = Server.objects.prefetch_related('interfaces').all()
            cache_individual_vms(vms)
            refresh_dashboard_stats(vms=vms)
            if DEBUG:
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