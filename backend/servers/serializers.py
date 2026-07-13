from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from .models import Server, PackageUpdate, Package, NetworkInterface, PatchSession
from .utils import cache_individual_vms
from notifications.models import PendingNotification
from notifications.tasks import process_notification

class PackageUpdateSerializer(serializers.ModelSerializer):
    """
    Simplified to a plain Serializer to handle the flat JSON 
    from the patching script without Model mapping conflicts.
    """
    package_name = serializers.CharField()
    version = serializers.CharField()

    class Meta:
        model = PackageUpdate
        fields = ['package_name', 'version']


class PatchSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatchSession
        fields = ['id', 'timestamp', 'status', 'was_rebooted', 'total_updated', 'duration', 'error_log', 'uptime']


class NetworkInterfaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkInterface
        fields = ['ip_address', 'mac_address', 'interface_name']
        extra_kwargs = {
            'ip_address': {'validators': []},
        }

class ServerSearchSerializer(serializers.ModelSerializer):
    """Used for the Quick Search Results."""
    last_patch_status = serializers.SerializerMethodField()

    class Meta:
        model = Server
        fields = [
            'id', 'server_id', 'hostname', 'os_version', 
            'last_reboot', 'last_patch_date', 'last_patch_status',
            'uptime', 'patch_schedule', 'enable_patching', 'env'
        ]

    def get_last_patch_status(self, obj):
        latest = obj.patch_sessions.only('status').first()
        return latest.status if latest else "unknown"


class ServerUpdateSerializer(serializers.ModelSerializer):
    """Used for updating server information."""
    server_id = serializers.CharField(read_only=True)
    class Meta:
        model = Server
        fields = ['server_id', 'enable_patching', 'patch_schedule', 'env', 'enable_notifications', 'enable_zabbix']


class ServerInfoSerializer(serializers.ModelSerializer):
    """Used to update the basic server info, during check ins"""
    interfaces = NetworkInterfaceSerializer(many=True)
    server_id = serializers.UUIDField(required=True)
    hostname = serializers.CharField(max_length=255)

    class Meta:
        model = Server
        fields = [
            'server_id', 'hostname', 'interfaces', 'os_version', 
            'last_reboot', 'uptime', 'patch_schedule', 'env',
            'date_registered', 'max_allowed_uptime', 'disable_autoremove',
            'enable_apt_release_info_change', 'reboot_on_success', 'reboot_after_updates',
            'was_rebooted'
        ]
    
    def update(self, instance, validated_data):
        return self._perform_save(validated_data, instance=instance)
    
    def create(self, validated_data):
        return self._perform_save(validated_data)

    def _perform_save(self, validated_data):
        interfaces_data = validated_data.pop('interfaces', [])
        server_uuid = validated_data.pop('server_id')

        with transaction.atomic():
            server, _ = Server.objects.update_or_create(
                    server_id=server_uuid,
                    defaults={**validated_data}
                )
            
            # IP Stealing & Interface Sync
            incoming_ips = [iface['ip_address'] for iface in interfaces_data]
            NetworkInterface.objects.filter(ip_address__in=incoming_ips).exclude(server=server).delete()
            server.interfaces.exclude(ip_address__in=incoming_ips).delete()
            for iface in interfaces_data:
                NetworkInterface.objects.update_or_create(
                    server=server, ip_address=iface['ip_address'],
                    defaults={'mac_address': iface.get('mac_address'), 'interface_name': iface.get('interface_name')}
                )
        
            cache_individual_vms([server])
            return server


class ServerPatchSerializer(serializers.ModelSerializer):
    """Used for the incoming patching script API using UUID lookups."""
    interfaces = NetworkInterfaceSerializer(many=True)
    packages = serializers.ListField(child=serializers.DictField(), write_only=True)
    status = serializers.ChoiceField(choices=PatchSession.STATUS_CHOICES, default='success', write_only=True)
    error_log = serializers.CharField(required=False, allow_blank=True, allow_null=True, write_only=True)
    server_id = serializers.UUIDField(required=True)
    hostname = serializers.CharField(max_length=255)
    was_rebooted = serializers.BooleanField(required=True)

    class Meta:
        model = Server
        fields = [
            'server_id', 'hostname', 'interfaces', 'os_version', 
            'last_reboot', 'uptime', 'total_packages_updated', 'duration',
            'packages', 'patch_schedule', 'env', 'status',
            'error_log', 'disable_autoremove', 'enable_apt_release_info_change', 
            'reboot_on_success', 'reboot_after_updates', 'max_allowed_uptime',
            'was_rebooted'
        ]

    def update(self, instance, validated_data):
        return self._perform_save(validated_data, instance=instance)
    
    def create(self, validated_data):
        return self._perform_save(validated_data)

    def _perform_save(self, validated_data):
        interfaces_data = validated_data.pop('interfaces', [])
        packages_data = validated_data.pop('packages', [])
        server_uuid = validated_data.pop('server_id')
        session_status = validated_data.pop('status', 'success')
        total_updated = validated_data.pop('total_packages_updated', 0)
        run_duration = validated_data.pop('duration', 0)
        session_errors = validated_data.pop('error_log', None)
        session_uptime = validated_data.get('uptime', '')
        was_session_rebooted = validated_data.get('was_rebooted', False)
        
        validated_data['last_patch_date'] = timezone.now()
        
        with transaction.atomic():
            # 1. Update Server Base Info
            server, _ = Server.objects.update_or_create(
                server_id=server_uuid,
                defaults={**validated_data, 'total_packages_updated': total_updated, 'duration': run_duration}
            )

            # 2. IP Stealing & Interface Sync 
            incoming_ips = [iface['ip_address'] for iface in interfaces_data]
            NetworkInterface.objects.filter(ip_address__in=incoming_ips).exclude(server=server).delete()
            server.interfaces.exclude(ip_address__in=incoming_ips).delete()
            for iface in interfaces_data:
                NetworkInterface.objects.update_or_create(
                    server=server, ip_address=iface['ip_address'],
                    defaults={'mac_address': iface.get('mac_address'), 'interface_name': iface.get('interface_name')}
                )

            # 3. Create the Patch Session (THE NEW HISTORY LOGIC)
            session = PatchSession.objects.create(
                server=server,
                status=session_status,
                was_rebooted=was_session_rebooted,
                error_log=session_errors,
                total_updated=total_updated,
                duration=run_duration,
                uptime=session_uptime
            )

            # 4. Log individual package updates within this session
            updates_to_create = []
            for pkg in packages_data:
                version_str = pkg.get('new_version') or pkg.get('version')
                package_obj, _ = Package.objects.get_or_create(
                    name=pkg['package_name'],
                    version=version_str
                )
                updates_to_create.append(PackageUpdate(
                    session=session,
                    package=package_obj,
                    new_version=version_str,
                    old_version=pkg.get('old_version')
                ))

            PackageUpdate.objects.bulk_create(updates_to_create)
            
            # 5. Creates the notification for celery to send
            msg_body = f"Patching session {session_status} for {server.hostname}."
            new_note = PendingNotification.objects.create(
                server=server,
                msg=msg_body,
                status=session_status,
                extra_data={
                    'server_name': server.hostname,
                    'updates_count': total_updated,
                    'duration': run_duration,
                    'was_rebooted': was_session_rebooted
                }
            )
            transaction.on_commit(lambda: process_notification.delay(new_note.id))

            cache_individual_vms([server])
            return server