from django.urls import path

from .views import TestDiscordService, TestEmailService


urlpatterns = [
    path('test/discord/', TestDiscordService.as_view(), name='test_discord'),
    path('test/email/', TestEmailService.as_view(), name='test_email'),
]