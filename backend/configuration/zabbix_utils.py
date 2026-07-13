import logging
from zabbix_utils import ZabbixAPI
from django.utils import timezone
from django.conf import settings

from .models import ZabbixMaintenance

logger = logging.getLogger('django')

def schedule_maintenance_window(hostname, server_id, config_dict):
    if not config_dict or not config_dict.get('enable'):
        return None

    hostname = hostname.strip()

    try:
        zapi = ZabbixAPI(config_dict['api_url'])
        zapi.login(token=config_dict['api_token'])

        lookups = [
            {"filter": {"host": hostname}},
            {"filter": {"name": hostname}},
        ]

        attempted_names = [hostname]
        
        if '.' in hostname:
            short_name = hostname.split('.')[0]
            attempted_names.append(short_name)
            lookups.extend([
                {"filter": {"host": short_name}},
                {"filter": {"name": short_name}},
            ])

        hosts = []
        for query_params in lookups:
            hosts = zapi.host.get(**query_params, output=["hostid"])
            if hosts:
                break
        
        if not hosts:
            tried_names = " or ".join(f"'{name}'" for name in attempted_names)
            raise ValueError(f"Host {tried_names} not found in Zabbix. Ensure exact case-sensitive match and API user Host Group permissions.")
        
        host_id = hosts[0]['hostid']

        start_date = int(timezone.now().timestamp()) - 30
        end_date = start_date + 3630 

        maintenance = zapi.maintenance.create({
            "name": f"Astraea Patching - {hostname}",
            "maintenance_type": 1,
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


def test_zabbix_connection(config_dict):
    """
    Tests the connection to Zabbix API using the provided configuration.
    Returns True if successful, raises an Exception otherwise.
    """
    if not config_dict.get('api_url') or not config_dict.get('api_token'):
        raise ValueError("Missing API URL or Token.")

    try:
        zapi = ZabbixAPI(config_dict['api_url'])
        zapi.login(token=config_dict['api_token'])
        version = zapi.apiinfo.version()
        logger.info(f"Zabbix connection successful. API Version: {version}")
        return True
        
    except Exception as e:
        logger.error(f"Zabbix connection test failed: {str(e)}")
        raise Exception(f"Connection test failed: {str(e)}")