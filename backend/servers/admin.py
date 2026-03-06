from django.contrib import admin

from .models import Server, Package, PackageUpdate, APIKey

@admin.register(Server)
class ServerAdmin(admin.ModelAdmin):
    fields = ('hostname', 'ip_address', 'mac_address', 'os_version', 'uptime', 'last_reboot', 'last_patch_date', 'total_packages_updated', 'patch_schedule', 'env')
    list_display = ('server_id', 'hostname', 'ip_address', 'mac_address', 'os_version', 'uptime', 'last_reboot', 'last_patch_date', 'total_packages_updated', 'patch_schedule', 'env')

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