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
        fields = ['id', 'server_id', 'hostname', 'ip_address', 'os_version', 'last_reboot', 'last_patch_date', 'mac_address', 'uptime', 'patch_schedule', 'env']


class ServerPatchSerializer(serializers.ModelSerializer):
    """Used for the incoming patching script API."""
    packages = PackageUpdateSerializer(many=True, write_only=True)
    hostname = serializers.CharField(max_length=255, validators=[])

    class Meta:
        model = Server
        fields = [
            'hostname', 'ip_address', 'mac_address', 'os_version', 
            'last_reboot', 'uptime', 'total_packages_updated', 'packages',
            'last_patch_date', 'patch_schedule', 'env'
        ]

    def create(self, validated_data):
        packages_data = validated_data.pop('packages')
        validated_data['last_patch_date'] = timezone.now()
        
        server, _ = Server.objects.update_or_create(
            hostname=validated_data.get('hostname'),
            defaults=validated_data
        )

        for pkg_data in packages_data:
            package_obj, _ = Package.objects.get_or_create(
                name=pkg_data['package_name'],
                version=pkg_data['version']
            )

            # Record the update event
            PackageUpdate.objects.get_or_create(server=server, package=package_obj)
            
        return server