import os
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include, re_path
from rest_framework_simplejwt.views import TokenRefreshView
from users.views import RegisterView, TokenOPView

from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/login/', TokenOPView.as_view(), name='token_obtain_pair'),
    path('api/login/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/register/', RegisterView.as_view(), name='auth_register'),

    path('api/users/', include('users.urls')),
    path('api/servers/', include('servers.urls')),

    # React entry
    re_path(r"", views.frontend_view),
]

