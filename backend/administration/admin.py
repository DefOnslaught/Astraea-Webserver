from django.contrib import admin

from .models import AgentUpdateCheck, UpdateCheck

@admin.register(UpdateCheck)
class UpdateCheckAdmin(admin.ModelAdmin):
    fields = ('latest_version_on_github',)
    list_display = ('last_checked_at', 'latest_version_on_github')


@admin.register(AgentUpdateCheck)
class AgentUpdateCheckAdmin(admin.ModelAdmin):
    fields = ('latest_version_on_github',)
    list_display = ('last_checked_at', 'latest_version_on_github')
