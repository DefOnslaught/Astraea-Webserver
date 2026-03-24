from django.contrib import admin

from .models import APIKey

@admin.register(APIKey)
class APIKeyAdmin(admin.ModelAdmin):
    fields = ('name', 'last_used', 'is_active')
    list_display = ('name', 'created_at', 'last_used', 'is_active')