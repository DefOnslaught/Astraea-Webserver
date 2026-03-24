from django.contrib import admin

from .models import APIKey, SysConfig

@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    fields = ('name', 'last_used', 'is_active')
    list_display = ('name', 'created_at', 'last_used', 'is_active')

@admin.register(SysConfig)
class SysConfigAdmin(admin.ModelAdmin):
    fields = ('patching_enabled', 'skip_email_validation')
    list_display = ('patching_enabled', 'skip_email_validation')