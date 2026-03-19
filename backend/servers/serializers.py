from rest_framework import serializers
from django.utils import timezone
from django.db import transaction
from .models import Server, PackageUpdate, Package, NetworkInterface
from .utils import cache_individual_vms

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


class NetworkInterfaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NetworkInterface
        fields = ['ip_address', 'mac_address', 'interface_name']
        extra_kwargs = {
            'ip_address': {'validators': []},
        }

class ServerSearchSerializer(serializers.ModelSerializer):
    """Used for the Quick Search Results."""
    class Meta:
        model = Server
        fields = ['id', 'server_id', 'hostname', 'os_version', 'last_reboot', 'last_patch_date', 'uptime', 'patch_schedule', 'enable_patching', 'env']


class ServerUpdateSerializer(serializers.ModelSerializer):
    """Used for updating server information."""
    server_id = serializers.CharField(read_only=True)
    class Meta:
        model = Server
        fields = ['server_id', 'enable_patching', 'patch_schedule', 'env']


class ServerPatchSerializer(serializers.ModelSerializer):
    """Used for the incoming patching script API using UUID lookups."""
    interfaces = NetworkInterfaceSerializer(many=True)
    packages = PackageUpdateSerializer(many=True, write_only=True)
    server_id = serializers.UUIDField(required=True)
    hostname = serializers.CharField(max_length=255)

    class Meta:
        model = Server
        fields = [
            'server_id', 'hostname', 'interfaces', 'os_version', 
            'last_reboot', 'uptime', 'total_packages_updated', 'packages',
            'patch_schedule', 'env'
        ]

    def update(self, instance, validated_data):
        """Redirect update to create to ensure IP stealing logic runs."""
        # We ignore 'instance' because our create() handles the update_or_create logic
        return self.create(validated_data)

    def create(self, validated_data):
        interfaces_data = validated_data.pop('interfaces', [])
        packages_data = validated_data.pop('packages')
        server_uuid = validated_data.pop('server_id')
        
        validated_data['last_patch_date'] = timezone.now()
        
        with transaction.atomic():
            # 1. Update/Create the Server itself
            server, created = Server.objects.update_or_create(
                server_id=server_uuid,
                defaults=validated_data
            )

            # 2. THE IP STEALER: Global cleanup
            # Identify all IPs incoming in this request
            incoming_ips = [iface['ip_address'] for iface in interfaces_data]
            
            # Remove these IPs from ANY other server immediately
            # This prevents IntegrityError when we try to assign them to 'server'
            NetworkInterface.objects.filter(
                ip_address__in=incoming_ips
            ).exclude(server=server).delete()

            # 3. Local Sync: Remove interfaces this server NO LONGER has
            server.interfaces.exclude(ip_address__in=incoming_ips).delete()

            # 4. Upsert current interfaces
            for iface_item in interfaces_data:
                NetworkInterface.objects.update_or_create(
                    server=server,
                    ip_address=iface_item['ip_address'],
                    defaults={
                        'mac_address': iface_item.get('mac_address'),
                        'interface_name': iface_item.get('interface_name')
                    }
                )
            
            for pkg_data in packages_data:
                package_obj, _ = Package.objects.get_or_create(
                    name=pkg_data['package_name'],
                    version=pkg_data['version']
                )

                PackageUpdate.objects.update_or_create(
                    server=server, 
                    package=package_obj,
                    defaults={'timestamp': timezone.now()} 
                )
            
            cache_individual_vms([server])

            return server