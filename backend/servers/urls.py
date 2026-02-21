from django.urls import path
from .views import (
    DashboardStatsView, 
    QuickVMSearchView, 
    PackageSearchView, 
    SavePatchingData
)

urlpatterns = [
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    path('servers/search/', QuickVMSearchView.as_view(), name='vm_search'),
    path('software/search/', PackageSearchView.as_view(), name='package_search'),
    path('patching/save/', SavePatchingData.as_view(), name='save_patching_data'),
]