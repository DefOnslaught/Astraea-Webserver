from django.urls import path

from .views import (
    BasicUserInfoView, 
    SessionStatusView, 
    LogoutView, 
    LogoutAllDevicesView, 
    CSRFTokenView, 
    RegisterView, 
    TokenOPView, 
    CustomTokenRefreshView
)

urlpatterns = [
    # Auth
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('login/', TokenOPView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('logout_all_devices/', LogoutAllDevicesView.as_view(), name='logout_all_devices'),

    # After Auth
    path('basic-info/', BasicUserInfoView.as_view(), name='basic-info'),
    path('session-status/', SessionStatusView.as_view(), name='session-status'),
    
    # CSRF
    path('csrf/', CSRFTokenView.as_view(), name="get_csrf_token"),
]
