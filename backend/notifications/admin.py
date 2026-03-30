from django.contrib import admin
from .models import PendingNotification

@admin.register(PendingNotification)
class PendingNotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'status', 'display_services', 'notifications_sent', 'retry_count', 'created_at')

    def display_services(self, obj):
        return ", ".join([s.name for s in obj.successful_services.all()])
    
    display_services.short_description = 'Successful Services'