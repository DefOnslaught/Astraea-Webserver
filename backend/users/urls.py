from django.urls import path

from .views.AuthViews import TokenOPView, RegisterView, CustomTokenRefreshView, LogoutView, LogoutAllDevicesView
from .views.LoggedInViews import BasicUserInfoView, SessionStatusView, SessionExtendView
from .views.VerificationViews import VerificationVerifyView, VerificationResendView
from .views.ResetPasswordViews import ResetPasswordView, ProcessPasswordResetView
from .views.BaseViews import CSRFTokenView
from .views.ProfileViews import UserProfileView, ChangePasswordView


urlpatterns = [
    # Auth
    path('register/', RegisterView.as_view(), name='auth_register'),
    path('verify/', VerificationVerifyView.as_view(), name='verify_user'),
    path('verify/resend/', VerificationResendView.as_view(), name='verify_user_resend'),
    path('login/', TokenOPView.as_view(), name='token_obtain_pair'),
    path('login/refresh/', CustomTokenRefreshView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('logout_all_devices/', LogoutAllDevicesView.as_view(), name='logout_all_devices'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('profile/change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('reset-password/', ResetPasswordView.as_view(), name='reset-password'),
    path('reset-password/reset/', ProcessPasswordResetView.as_view(), name='reset-password-reset'),

    # After Auth
    path('basic-info/', BasicUserInfoView.as_view(), name='basic-info'),
    path('session-status/', SessionStatusView.as_view(), name='session-status'),
    path('session-extend/', SessionExtendView.as_view(), name='session-extend'),
    
    # CSRF
    path('csrf/', CSRFTokenView.as_view(), name="get_csrf_token"),
]
