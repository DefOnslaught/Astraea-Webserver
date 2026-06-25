import logging
from zabbix_utils import ZabbixAPI
from django.utils import timezone
from django.conf import settings

from .models import ZabbixMaintenance

logger = logging.getLogger('django')

def schedule_maintenance_window(hostname, server_id, config_dict):
    if not config_dict or not config_dict.get('enable'):
        return None

    try:
        zapi = ZabbixAPI(config_dict['api_url'])
        zapi.login(api_token=config_dict['api_token'])

        hosts = zapi.host.get(filter={"host": hostname})
        if not hosts:
            raise ValueError(f"Host {hostname} not found in Zabbix.")
        host_id = hosts[0]['hostid']

        start_date = int(timezone.now().timestamp()) - 30
        end_date = start_date + 3630 

        maintenance = zapi.maintenance.create({
            "name": f"Astraea Patching - {hostname}",
            "active_since": start_date,
            "active_till": end_date,
            "hostids": [host_id],
            "timeperiods": [{"timeperiod_type": 0, "period": 3600, "start_date": start_date}]
        })

        maintenance_id = maintenance['maintenanceids'][0]

        m_record = ZabbixMaintenance.objects.create(
            zabbix_config_id=config_dict['id'],
            host_id=host_id,
            server_id=server_id,
            maintenance_id=maintenance_id
        )

        if settings.DEBUG:
            logger.info(f"Successfully created maintenance window for host `{hostname}`")
        
        return m_record.id

    except Exception as e:
        logger.error(f"Zabbix Maintenance Creation Failed: {str(e)}")
        raise


def complete_maintenance_window(tracking_id):
    """
    Schedule a Zabbix maintenance window deletion in 3 minutes.
    This allows for the server to reboot
    """
    from .tasks import remove_zabbix_maintenance
    remove_zabbix_maintenance.apply_async(args=[tracking_id], countdown=180)