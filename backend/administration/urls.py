from django.urls import path

from .views.UserAccountViews import FetchUsers, InspectUser, CreateNewUser
from .views.ServerMaintenance import (RefreshCacheView, CeleryMonitoringView, DatabaseStatsView, 
                                      SystemStatsView, SystemLogsView, PurgeDatabaseOldPackagesView, 
                                      DeleteAllReports, ClearAllLogs, DeletePatchHistoryView,
                                      CheckUpdateView, CheckAgentUpdateView, UpdateAgentView)


urlpatterns = [
    path('fetch_users/', FetchUsers.as_view(), name='fetch_users'),
    path('inspect_user/<str:username>/', InspectUser.as_view(), name='inspect_user'),
    path('create_user/', CreateNewUser.as_view(), name='create_user'),

    path('refresh_cache/', RefreshCacheView.as_view(), name='refresh_cache'),
    path('celery_stats/', CeleryMonitoringView.as_view(), name='celery_stats'),
    path('db_stats/', DatabaseStatsView.as_view(), name='db_stats'),
    path('system_stats/', SystemStatsView.as_view(), name='system_stats'),
    path('system_logs/<str:log_type>/', SystemLogsView.as_view(), name='system_logs'),
    path('purge_old_packages/', PurgeDatabaseOldPackagesView.as_view(), name='purge_old_packages'),
    path('delete_all_reports/', DeleteAllReports.as_view(), name='delete_all_reports'),
    path('clear_all_logs/', ClearAllLogs.as_view(), name='clear_all_logs'),
    path('delete_patch_history/<int:days>/', DeletePatchHistoryView.as_view(), name='delete_patch_history'),
    path('check_for_update/', CheckUpdateView.as_view(), name='check_for_update'),
    path('check_for_agent_update/', CheckAgentUpdateView.as_view(), name='check_for_agent_update'),
    path('trigger_agent_update/', UpdateAgentView.as_view(), name='trigger_agent_update'),
]