from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from .views.DashboardViews import DashboardStatsView
from .views.ServersSearchViews import QuickVMSearchView
from .views.PackageSearchViews import PackageSearchView, PackageServerListView
from .views.AstraeaAgentAPIViews import ServerPatchingEnableCheck, RegisterServer, SaveServerInfo, SavePatchingData
from .views.ServerConfigureViews import DeleteServer, UpdateServerInfo
from .views.ServerInspectViews import InspectServerInfo, ServerPatchHistory, ServerPackageInventory, PatchSessionDetail

urlpatterns = [
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('search/', QuickVMSearchView.as_view(), name='vm_search'),
    path('software/search/', PackageSearchView.as_view(), name='package_search'),
    path('software/server_list/', PackageServerListView.as_view(), name='package_server_list'),
    path('register_server/', csrf_exempt(RegisterServer.as_view()), name='register_server'),
    path('patching/can_i_patch/', csrf_exempt(ServerPatchingEnableCheck.as_view()), name='can_i_patch'),
    path('patching/system_info/', csrf_exempt(SaveServerInfo.as_view()), name='save_server_info'),
    path('patching/save/', csrf_exempt(SavePatchingData.as_view()), name='save_patching_data'),
    path('inspect/', InspectServerInfo.as_view(), name='inspect_server'),
    path('inspect/history/', ServerPatchHistory.as_view(), name='inspect_history'),
    path('inspect/packages/', ServerPackageInventory.as_view(), name='inspect_packages'),
    path('inspect/patch_session/', PatchSessionDetail.as_view(), name='inspect_patch_session'),
    path('patching/update/', UpdateServerInfo.as_view(), name='update_server'),
    path('patching/delete/', DeleteServer.as_view(), name='delete_server'),
]