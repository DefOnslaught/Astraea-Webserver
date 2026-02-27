from django.urls import path

from .views import BasicUserInfoView, SessionStatusView, LogoutView, LogoutAllDevicesView, CSRFTokenView

urlpatterns = [
    path('basic-info/', BasicUserInfoView.as_view(), name='basic-info'),
    path('session-status/', SessionStatusView.as_view(), name='session-status'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('logout_all_devices/', LogoutAllDevicesView.as_view(), name='logout_all_devices'),
    path('csrf/', CSRFTokenView.as_view(), name="get_csrf_token"),
]
