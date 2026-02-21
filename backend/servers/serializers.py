from rest_framework import serializers
from .models import Server, PackageUpdate, Package

class PackageUpdateSerializer(serializers.ModelSerializer):
    package_name = serializers.CharField(source='package.name')
    version = serializers.CharField(source='package.version')
    
    class Meta:
        model = PackageUpdate
        fields = ['package_name', 'version']


class ServerSearchSerializer(serializers.ModelSerializer):
    """Used for the Quick Search Results."""
    class Meta:
        model = Server
        fields = ['id', 'hostname', 'ip_address', 'os_version', 'rebooted', 'last_patch_date']


class ServerPatchSerializer(serializers.ModelSerializer):
    """Used for the incoming patching script API."""
    packages = PackageUpdateSerializer(many=True, write_only=True)

    class Meta:
        model = Server
        fields = [
            'hostname', 'ip_address', 'mac_address', 'os_version', 
            'rebooted', 'uptime', 'total_packages_updated', 'packages'
        ]

    def create(self, validated_data):
        packages_data = validated_data.pop('packages')
        
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