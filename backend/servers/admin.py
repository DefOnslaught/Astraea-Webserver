from django.contrib import admin

from .models import Server, NetworkInterface, Package, PackageUpdate, APIKey

@admin.register(Server)
class ServerAdmin(admin.ModelAdmin):
    fields = ('hostname', 'os_version', 'uptime', 'last_reboot', 'last_patch_date', 'total_packages_updated', 'patch_schedule', 'env', 'enable_patching')
    list_display = ('server_id', 'hostname', 'os_version', 'uptime', 'last_reboot', 'last_patch_date', 'total_packages_updated', 'patch_schedule', 'env', 'enable_patching')

@admin.register(NetworkInterface)
class NetworkInterfaceAdmin(admin.ModelAdmin):
    fields = ('server', 'ip_address', 'mac_address', 'interface_name')
    list_display = ('server', 'ip_address', 'mac_address', 'interface_name')

@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    fields = ('name', 'version')
    list_display = ('name', 'version')

@admin.register(PackageUpdate)
class PackageUpdateAdmin(admin.ModelAdmin):
    fields = ('server', 'package')
    list_display = ('server', 'package', 'timestamp')

@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    fields = ('name', 'created_at', 'last_used', 'is_active')
    list_display = ('name', 'created_at', 'last_used', 'is_active')