from django.contrib import admin

from .models import APIKey, SysConfig, NotificationSettings, NotificationService, AgentInstallConfig, AstraeaAgentInfo

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
    fields = ('failed', 'success', 'partial', 'out_of_date')
    list_display = ('failed', 'success', 'partial', 'out_of_date')

@admin.register(NotificationService)
class NotificationServiceAdmin(admin.ModelAdmin):
    fields = ('name', 'type', 'url', 'recipients', 'active')
    list_display = ('id', 'name', 'type', 'url', 'recipients', 'active', 'created_at')

@admin.register(AgentInstallConfig)
class AgentInstallConfigAdmin(admin.ModelAdmin):
    fields = ('label', 'api_key', 'exe_logic', 'environment', 'cron')
    list_display = ('label', 'api_key', 'uid', 'exe_logic', 'environment', 'cron', 'created_at')

@admin.register(AstraeaAgentInfo)
class AstraeaAgentInfoAdmin(admin.ModelAdmin):
    list_display = ('version', 'updated_at')