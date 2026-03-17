from rest_framework import serializers
from django.utils import timezone
from .models import Server, PackageUpdate, Package

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


class ServerSearchSerializer(serializers.ModelSerializer):
    """Used for the Quick Search Results."""
    class Meta:
        model = Server
        fields = ['id', 'server_id', 'hostname', 'ip_address', 'os_version', 'last_reboot', 'last_patch_date', 'mac_address', 'uptime', 'patch_schedule', 'enable_patching', 'env']


class ServerUpdateSerializer(serializers.ModelSerializer):
    """Used for updating server information."""
    server_id = serializers.CharField(read_only=True)
    class Meta:
        model = Server
        fields = ['server_id', 'enable_patching', 'patch_schedule', 'env']


class ServerPatchSerializer(serializers.ModelSerializer):
    """Used for the incoming patching script API using UUID lookups."""
    packages = PackageUpdateSerializer(many=True, write_only=True)
    server_id = serializers.UUIDField(required=True)
    hostname = serializers.CharField(max_length=255)

    class Meta:
        model = Server
        fields = [
            'server_id', 'hostname', 'ip_address', 'mac_address', 'os_version', 
            'last_reboot', 'uptime', 'total_packages_updated', 'packages',
            'patch_schedule', 'env'
        ]

    def create(self, validated_data):
        packages_data = validated_data.pop('packages')
        server_uuid = validated_data.pop('server_id')
        
        validated_data['last_patch_date'] = timezone.now()
        
        server, created = Server.objects.update_or_create(
            server_id=server_uuid,
            defaults=validated_data
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
            
        return server