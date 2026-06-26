from django.urls import path

from .views import FetchUsers, InspectUser, CreateNewUser, RefreshCacheView, CeleryMonitoringView


urlpatterns = [
    path('fetch_users/', FetchUsers.as_view(), name='fetch_users'),
    path('inspect_user/<str:username>/', InspectUser.as_view(), name='inspect_user'),
    path('create_user/', CreateNewUser.as_view(), name='create_user'),

    path('refresh_cache/', RefreshCacheView.as_view(), name='refresh_cache'),
    path('celery_stats/', CeleryMonitoringView.as_view(), name='celery_stats'),
]