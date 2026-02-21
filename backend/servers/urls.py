from django.urls import path
from .views import (
    DashboardStatsView, 
    QuickVMSearchView, 
    PackageSearchView, 
    SavePatchingData,
    DeleteServer,
    CreateAPIKeyView
)

urlpatterns = [
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('servers/search/', QuickVMSearchView.as_view(), name='vm_search'),
    path('software/search/', PackageSearchView.as_view(), name='package_search'),
    path('patching/save/', SavePatchingData.as_view(), name='save_patching_data'),
    path('patching/delete/', DeleteServer.as_view(), name='delete_server'),
    path('patching/api-key/create/', CreateAPIKeyView.as_view(), name='create_api_key'),
]