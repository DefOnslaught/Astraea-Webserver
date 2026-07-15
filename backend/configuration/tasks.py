import logging, requests
from packaging import version
from datetime import timedelta
from celery import shared_task
from zabbix_utils import ZabbixAPI
from django.conf import settings
from django.utils import timezone

from .models import ZabbixMaintenance
from .zabbix_utils import schedule_maintenance_window
from .utils import get_notification_config
from administration.models import UpdateCheck
from administration.utils import get_version, normalize_version
from notifications.models import PendingNotification
from notifications.tasks import process_notification

logger = logging.getLogger('django')


@shared_task(bind=True, max_retries=3)
def schedule_zabbix_maintenance_task(self, hostname, server_id, config_dict):
    try:
        return schedule_maintenance_window(hostname, server_id, config_dict)
    except Exception as e:
        raise self.retry(exc=e, countdown=60)


@shared_task(bind=True, max_retries=5)
def remove_zabbix_maintenance(self, tracking_id):
    try:
        record = ZabbixMaintenance.objects.get(id=tracking_id)
        config = record.zabbix_config
        
        zapi = ZabbixAPI(config.api_url)
        zapi.login(token=config.api_token)
        
        zapi.maintenance.delete([record.maintenance_id])
        
        record.delete()
        if settings.DEBUG:
            logger.info(f"Successfully removed maintenance window {record.maintenance_id}")
            
    except ZabbixMaintenance.DoesNotExist:
        if settings.DEBUG:
            logger.warning("Maintenance tracking record already deleted.")
    except Exception as e:
        logger.error(f"Failed to remove Zabbix maintenance window: {str(e)}")
        raise self.retry(exc=e, countdown=60)


@shared_task(name="configuration.tasks.failsafe_cleanup_orphans")
def failsafe_cleanup_orphans():
    """
    Sweeps for maintenance windows that were created over 65 minutes ago 
    (giving a 5-minute grace period past the 1-hour window).
    """
    cutoff_time = timezone.now() - timedelta(minutes=65)
    orphans = ZabbixMaintenance.objects.filter(created_at__lt=cutoff_time)
    
    if orphans.exists():
        if settings.DEBUG:
            logger.warning(f"Found {orphans.count()} orphaned Zabbix maintenance windows. Executing failsafe cleanup.")
        
        for record in orphans:
            remove_zabbix_maintenance.delay(record.id)


@shared_task(name="configuration.tasks.check_if_site_outdated")
def check_if_site_outdated():
    """
    Checks if the site is outdated and dispatches an alert if a new version exists.
    """
    
    n_settings = get_notification_config()
    is_enabled = n_settings.get("site_outdated", True)
    
    if not is_enabled:
        if settings.DEBUG:
            logger.info("Skipping task 'check_if_site_outdated' per site configuration")
        return
    
    REPO_OWNER = "DefOnslaught"
    REPO_NAME = "Astraea-Webserver"
    RELEASE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"

    try:
        update, _ = UpdateCheck.objects.get_or_create(id=1)
        raw_current = get_version()
        now = timezone.now()
        raw_latest = None
        
        if update.last_checked_at and (now - update.last_checked_at) < timedelta(hours=1):
            raw_latest = update.latest_version_on_github
        else:
            response = requests.get(RELEASE_URL, timeout=10)
            response.raise_for_status()
            release_data = response.json()
            raw_latest = release_data.get('tag_name')

            update.latest_version_on_github = raw_latest
            update.last_checked_at = now
            update.save()
        
        if not raw_latest:
            logger.warning("Could not determine latest version from GitHub.")
            return
        
        current_version = normalize_version(raw_current)
        latest_version = normalize_version(raw_latest)
        update_available = version.parse(latest_version) > version.parse(current_version)

        if update_available:
            download_url = f"https://github.com/{REPO_OWNER}/{REPO_NAME}/releases/tag/{raw_latest}"
            
            notification = PendingNotification.objects.create(
                status='outdated',
                msg=f"Astraea Webserver version {latest_version} has been released. Please schedule maintenance.",
                extra_data={
                    'category': 'update_check',
                    'server_name': 'Astraea Central Instance',
                    'current_version': current_version,
                    'target_version': latest_version,
                    'download_url': download_url
                }
            )
            
            process_notification(notification)
            logger.info(f"Dispatched update notification for Astraea Version {latest_version}")
        else:
            if settings.DEBUG:
                logger.info(f"Astraea is up to date (Version {current_version}).")
                
    except requests.exceptions.RequestException as e:
        logger.error(f"GitHub API check failed in Celery task: {str(e)}")
    except Exception as e:
        logger.error(f"Error checking for Astraea Webserver updates in Celery task: {str(e)}")