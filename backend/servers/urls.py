from django.urls import path
from .views import (
    DashboardStatsView, 
    QuickVMSearchView, 
    PackageSearchView,
    PackageServerListView,
    ServerPatchingEnableCheck,
    RegisterServer,
    SavePatchingData,
    DeleteServer,
    UpdateServerInfo,
    InspectServerInfo,
    ServerPatchHistory,
    ServerPackageInventory,
    PatchSessionDetail,
    PurgeDatabaseOldPackagesView
)

urlpatterns = [
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('search/', QuickVMSearchView.as_view(), name='vm_search'),
    path('software/search/', PackageSearchView.as_view(), name='package_search'),
    path('software/server_list/', PackageServerListView.as_view(), name='package_server_list'),
    path('software/purge_old_packages/', PurgeDatabaseOldPackagesView.as_view(), name='purge_old_packages'),
    path('register_server/', RegisterServer.as_view(), name='register_server'),
    path('patching/can_i_patch/', ServerPatchingEnableCheck.as_view(), name='can_i_patch'),
    path('patching/save/', SavePatchingData.as_view(), name='save_patching_data'),
    path('inspect/', InspectServerInfo.as_view(), name='inspect_server'),
    path('inspect/history/', ServerPatchHistory.as_view(), name='inspect_history'),
    path('inspect/packages/', ServerPackageInventory.as_view(), name='inspect_packages'),
    path('inspect/patch_session/', PatchSessionDetail.as_view(), name='inspect_patch_session'),
    path('patching/update/', UpdateServerInfo.as_view(), name='update_server'),
    path('patching/delete/', DeleteServer.as_view(), name='delete_server'),
]