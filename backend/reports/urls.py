from django.urls import path

from .views import GetFiltersView, GetFinishedReports, CreateQueryView, AvailableFieldsView, CheckReportRequestView, DownloadReportFile, EditFiltersView, DeleteReportFilter, DeleteReport

urlpatterns = [
    path('get_filters/', GetFiltersView.as_view(), name='get_filters'),
    path('get_finished_reports/', GetFinishedReports.as_view(), name='get_finished_reports'),
    path('create_query/', CreateQueryView.as_view(), name='create_query'),
    path('get_available_fields/', AvailableFieldsView.as_view(), name='get_available_fields'),
    path('check_report/<str:report_id>/', CheckReportRequestView.as_view(), name='check_report'),
    path('download_report/<str:report_id>/', DownloadReportFile.as_view(), name='download_report'),
    path('edit_filter/<str:filter_id>/', EditFiltersView.as_view(), name='edit_filter'),
    path('delete_filter/<str:filter_id>/', DeleteReportFilter.as_view(), name='delete_filter'),
    path('delete_report/<str:report_id>/', DeleteReport.as_view(), name='delete_request'),
]