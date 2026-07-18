from django.contrib import admin

from .models import APIKey, SysConfig, NotificationSettings, NotificationService, AgentInstallConfig, AstraeaAgentInfo, ZabbixConfiguration, ZabbixMaintenance

@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    fields = ('name', 'last_used', 'is_active')
    list_display = ('name', 'created_at', 'last_used', 'is_active')

@admin.register(SysConfig)
class SysConfigAdmin(admin.ModelAdmin):
    fields = ('patching_enabled', 'skip_email_validation', 'disable_registration')
    list_display = ('patching_enabled', 'skip_email_validation', 'disable_registration')

@admin.register(NotificationSettings)
class NotificationSettingsAdmin(admin.ModelAdmin):
    fields = ('failed', 'success', 'partial', 'out_of_date', 'on_server_add', 'on_server_modify', 'on_server_delete', 'site_outdated')
    list_display = ('failed', 'success', 'partial', 'out_of_date', 'on_server_add', 'on_server_modify', 'on_server_delete', 'site_outdated')

@admin.register(NotificationService)
class NotificationServiceAdmin(admin.ModelAdmin):
    fields = ('name', 'type', 'url', 'email_all_users', 'main_email_recipients', 'recipients', 'active')
    list_display = ('id', 'name', 'type', 'url', 'email_all_users', 'main_email_recipients', 'recipients', 'active', 'created_at')

@admin.register(AgentInstallConfig)
class AgentInstallConfigAdmin(admin.ModelAdmin):
    fields = ('label', 'api_key', 'base_url', 'exe_logic', 'environment', 'disable_autoremove', 'enable_apt_release_info_change', 'reboot_on_success', 'reboot_after_updates', 'max_allowed_uptime', 'cron', 'patching_schedule')
    list_display = ('label', 'api_key', 'base_url', 'uid', 'exe_logic', 'environment', 'disable_autoremove', 'enable_apt_release_info_change', 'reboot_on_success', 'reboot_after_updates', 'max_allowed_uptime', 'cron', 'patching_schedule', 'created_at')

@admin.register(AstraeaAgentInfo)
class AstraeaAgentInfoAdmin(admin.ModelAdmin):
    list_display = ('version', 'updated_at')

@admin.register(ZabbixConfiguration)
class SysConfigAdmin(admin.ModelAdmin):
    fields = ('enable', 'api_url', 'api_token')
    list_display = ('enable', 'api_url', 'api_token')

@admin.register(ZabbixMaintenance)
class NotificationServiceAdmin(admin.ModelAdmin):
    fields = ('zabbix_config', 'server_id', 'host_id', 'maintenance_id')
    list_display = ('zabbix_config', 'server_id', 'host_id', 'maintenance_id', 'created_at')