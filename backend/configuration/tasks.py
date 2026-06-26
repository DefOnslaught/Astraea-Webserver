import logging
from datetime import timedelta
from celery import shared_task
from zabbix_utils import ZabbixAPI
from django.conf import settings
from django.utils import timezone

from .models import ZabbixMaintenance
from .zabbix_utils import schedule_maintenance_window

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