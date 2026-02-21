import os, threading, logging
from datetime import timedelta
from django.core.cache import cache
from django.utils import timezone
from django.db import close_old_connections
from django.db.models import Q

from .models import Server

logger = logging.getLogger('django')


def get_dashboard_stats():
    """Returns stats from cache, or calculates them if missing."""
    stats = cache.get("dashboard_stats")
    return stats if stats else refresh_dashboard_stats()


def refresh_dashboard_stats(vms=None):
    """Calculates summary stats. Pass 'vms' list to avoid DB hits."""
    # Get threshold from .env or default to 30 days
    days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
    time_threshold = timezone.now() - timedelta(days=days)

    if vms is None:
        # DB-side calculation (used by Views/Signals)
        vms_qs = Server.objects.only('id', 'last_patch_date')
        total_servers = vms_qs.count()
        outdated_servers = vms_qs.filter(
            Q(last_patch_date__lt=time_threshold) | Q(last_patch_date__isnull=True)
        ).count()
    else:
        # In-memory calculation (used by Management Command)
        total_servers = len(vms)
        outdated_servers = 0
        for vm in vms:
            lp_date = vm.last_patch_date if hasattr(vm, 'last_patch_date') else vm.get('last_patch_date')
            if lp_date is None or lp_date < time_threshold:
                outdated_servers += 1

    stats = {
        "total_servers": total_servers,
        "outdated_servers": outdated_servers,
        "last_updated": timezone.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    cache.set("dashboard_stats", stats, timeout=None)
    return stats


def update_dashboard_counts(was_outdated, is_outdated, is_new=False, is_deleted=False):
    """
    Adjusts total and outdated counts in Redis without querying the database.
    """
    stats = cache.get("dashboard_stats")
    if not stats:
        # If cache is empty, just do a full refresh
        return refresh_dashboard_stats()

    # 1. Handle Total Count
    if is_new:
        stats["total_servers"] += 1
    elif is_deleted:
        stats["total_servers"] -= 1

    # 2. Handle Outdated Logic
    if was_outdated and not is_outdated:
        # Server was patched!
        stats["outdated_servers"] = max(0, stats["outdated_servers"] - 1)
    elif not was_outdated and is_outdated:
        # Server became outdated or was added as outdated
        stats["outdated_servers"] += 1

    stats["last_updated"] = timezone.now().strftime("%Y-%m-%d %H:%M:%S")
    cache.set("dashboard_stats", stats, timeout=None)
    return stats


def cache_individual_vms(vms):
    """Takes a list or queryset of VMs and bulk-updates their Redis entries."""
    payload = {}
    for vm in vms:
        vm_id = vm.id if hasattr(vm, 'id') else vm.get('id')
        # Use a helper to handle both object and dict access seamlessly
        def get_val(attr, default=None):
            if hasattr(vm, attr): return getattr(vm, attr)
            if isinstance(vm, dict): return vm.get(attr, default)
            return default

        payload[f"server_data:{vm_id}"] = {
            "id": vm_id,
            "hostname": get_val('hostname', 'Unknown'),
            "ip_address": get_val('ip_address', '0.0.0.0'),
            "mac_address": get_val('mac_address', ''),
            "os_version": get_val('os_version', 'Unknown'),
            "rebooted": get_val('rebooted', False),
            "uptime": get_val('uptime', ''),
            "last_patch": str(get_val('last_patch_date')) if get_val('last_patch_date') else None
        }
    if payload:
        cache.set_many(payload, timeout=None)


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
            fields = ['id', 'hostname', 'ip_address', 'last_patch_date', 'os_version', 'rebooted']
            vms = list(Server.objects.values(*fields))
            cache_individual_vms(vms)
            refresh_dashboard_stats(vms=vms)
            logger.info("Background cache warming completed.")
        except Exception as e:
            logger.error(f"Background cache warm failed: {e}")
        finally:
            cache.delete("is_warming")
            close_old_connections()
    
    threading.Thread(target=task, daemon=True).start()