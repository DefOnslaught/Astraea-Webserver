from django.contrib import admin
from django.urls import path, include, re_path

from .views import frontend_view

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/users/', include('users.urls')),
    path('api/servers/', include('servers.urls')),

    # React entry
    re_path(r"", frontend_view),
]