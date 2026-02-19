from django.urls import path

from .views import BasicUserInfoView, LogoutView, LogoutAllDevicesView

urlpatterns = [
    path('basic-user-info/', BasicUserInfoView.as_view(), name='basic-user-info'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('logout_all_devices/', LogoutAllDevicesView.as_view(), name='logout_all_devices'),
]
