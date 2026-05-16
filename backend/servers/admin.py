from django.contrib import admin

from .models import Server, NetworkInterface, Package, PackageUpdate, PatchSession

@admin.register(Server)
class ServerAdmin(admin.ModelAdmin):
    fields = ('hostname', 'os_version', 'uptime', 'last_reboot', 'last_patch_date', 'total_packages_updated', 'patch_schedule', 'env', 'enable_patching', 'enable_notifications')
    list_display = ('server_id', 'hostname', 'os_version', 'uptime', 'last_reboot', 'last_patch_date', 'total_packages_updated', 'patch_schedule', 'env', 'enable_patching', 'date_registered', 'enable_notifications')

@admin.register(NetworkInterface)
class NetworkInterfaceAdmin(admin.ModelAdmin):
    fields = ('server', 'ip_address', 'mac_address', 'interface_name')
    list_display = ('server', 'ip_address', 'mac_address', 'interface_name')

@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    fields = ('name', 'version')
    list_display = ('name', 'version')

@admin.register(PatchSession)
class PatchSessionAdmin(admin.ModelAdmin):
    fields = ('server', 'status', 'error_log', 'total_updated')
    list_display = ('server', 'timestamp', 'status', 'error_log', 'total_updated')

@admin.register(PackageUpdate)
class PackageUpdateAdmin(admin.ModelAdmin):
    fields = ('session', 'package', 'old_version', 'new_version')
    list_display = ('session', 'package', 'old_version', 'new_version')