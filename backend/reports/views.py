import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.core.exceptions import ValidationError
from django.http import FileResponse
from django.db.models import Q

from .utils import get_public_global_filters, get_user_filters
from .models import ReportFilter, ReportRequest
from .tasks import generate_dynamic_report_task
from .serializers import ReportFilterSerializer, ReportRequestSerializer
from users.permissions import checkIsStaff

logger = logging.getLogger('django')

class GetFiltersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        shared_filters = get_public_global_filters()
        personal_filters = get_user_filters(request.user)
        combined_dict = {f['id']: f for f in list(shared_filters) + list(personal_filters)}
        combined_filters = list(combined_dict.values())
        return Response(combined_filters, status=status.HTTP_200_OK)
    
class GetFinishedReports(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        statuses = ['completed', 'failed']
        
        if checkIsStaff(request.user):
            reports = ReportRequest.objects.filter(status__in=statuses)
        else:
            reports = ReportRequest.objects.filter(status__in=statuses, user=request.user)
        
        reports = reports.order_by('-updated_at')
        serializer = ReportRequestSerializer(reports, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# This prevents malicious traversal into User authentication models or heavy unindexed tables.
ALLOWED_REPORT_FIELDS = {
    # Core Server Fields
    'hostname', 'os_version', 'uptime', 'last_reboot', 'last_patch_date',
    'was_rebooted', 'patch_schedule', 'enable_patching', 'env', 
    'disable_autoremove', 'enable_apt_release_info_change', 'reboot_on_success', 
    'reboot_after_updates', 'max_allowed_uptime', 'total_packages_updated', 
    'duration', 'date_registered', 'enable_notifications', 'enable_zabbix',
    
    # Allowed Relational Fields (Interfaces & Sessions)
    'interfaces__ip_address', 'interfaces__mac_address', 'interfaces__interface_name',
    'patch_sessions__status', 'patch_sessions__timestamp', 'patch_sessions__was_rebooted',
    'patch_sessions__total_updated', 'patch_sessions__duration', 'patch_sessions__uptime',
    'patch_sessions__package_details__package__name', 'patch_sessions__package_details__package__version',
    'patch_sessions__package_details__old_version', 'patch_sessions__package_details__new_version'
}

# Standard Django lookup suffix suffixes to strip during validation
DJANGO_LOOKUPS = (
    '__exact', '__iexact', '__contains', '__icontains', '__in', '__gt', '__gte', 
    '__lt', '__lte', '__startswith', '__istartswith', '__endswith', '__iendswith', '__isnull'
)

def validate_frontend_criteria(criteria: dict):
    """
    Validates that the provided criteria keys map safely to approved infrastructure fields,
    handling multiple layers of Django lookups.
    """
    check_criteria = {k: v for k, v in criteria.items() if k != 'only_latest_session'}
    
    for key in check_criteria.keys():
        cleaned_key = key
        changed = True
        while changed:
            changed = False
            for lookup in sorted(DJANGO_LOOKUPS, key=len, reverse=True):
                if cleaned_key.endswith(lookup):
                    cleaned_key = cleaned_key[:-len(lookup)]
                    changed = True
                    break
        
        if cleaned_key not in ALLOWED_REPORT_FIELDS:
            if not any(f.startswith(f"{cleaned_key}__") for f in ALLOWED_REPORT_FIELDS):
                raise ValidationError(f"The filter criteria field '{key}' is invalid or restricted.")

def validate_selected_fields(fields: list):
    """Ensure requested output columns are safe."""
    if not isinstance(fields, list) or not fields:
        raise ValidationError("You must select at least one field to generate a report.")
        
    for field in fields:
        if field not in ALLOWED_REPORT_FIELDS:
            raise ValidationError(f"The field '{field}' is invalid or restricted.")

class CreateQueryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        filter_id = request.data.get('filter_id')
        file_name = request.data.get('file_name')
        criteria = request.data.get('criteria', {})
        selected_fields = request.data.get('selected_fields', [])
        filter_description = request.data.get('filter_description', '')
        save_filter = request.data.get('save_filter', False)
        filter_name = request.data.get('filter_name', '')
        is_public = request.data.get('is_public', False)
        is_global = request.data.get('is_global', False)

        if file_name:
            if any(char in file_name for char in ['/', '\\', '..']):
                return Response({"error": "Invalid filename characters."}, status=status.HTTP_400_BAD_REQUEST)

        report_filter = None
        if filter_id:
            report_filter = get_object_or_404(ReportFilter, 
                Q(id=filter_id) & (Q(user=request.user) | Q(is_public=True) | Q(is_global=True))
            )
            criteria = criteria or report_filter.criteria
            selected_fields = selected_fields or report_filter.selected_fields

        if not criteria:
            return Response({"error": "Criteria is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            validate_frontend_criteria(criteria)
            validate_selected_fields(selected_fields)
        except ValidationError as val_err:
            error_message = val_err.message if hasattr(val_err, 'message') else val_err.messages[0]
            return Response({"error": error_message}, status=status.HTTP_400_BAD_REQUEST)

        if save_filter:
            if filter_id and report_filter and report_filter.user == request.user:
                try:
                    report_filter.criteria = criteria
                    report_filter.selected_fields = selected_fields
                    report_filter.description = filter_description
                    report_filter.save()
                except ValidationError as e:
                     return Response(e.message_dict if hasattr(e, 'message_dict') else {"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            else:
                if not filter_name:
                    return Response({"error": "Name required for new filter."}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    report_filter = ReportFilter.objects.create(
                        user=request.user,
                        name=filter_name,
                        criteria=criteria,
                        description=filter_description,
                        selected_fields=selected_fields,
                        is_public=is_public,
                        is_global=is_global
                    )
                except ValidationError as e:
                    return Response(e.message_dict if hasattr(e, 'message_dict') else {"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not file_name:
            file_name = None

        report_request = ReportRequest.objects.create(
            user=request.user,
            report_filter=report_filter,
            file_name=file_name,
            applied_criteria=criteria,
            selected_fields=selected_fields,
            status='pending'
        )

        generate_dynamic_report_task.delay(str(report_request.id))

        return Response({
            "message": "Report compilation scheduled successfully.",
            "report_id": report_request.id
        }, status=status.HTTP_202_ACCEPTED)


class AvailableFieldsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        return Response(list(ALLOWED_REPORT_FIELDS))


class CheckReportRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        report = get_object_or_404(ReportRequest, id=report_id, user=request.user)
        
        data = {
            'report_id': report.id,
            'file_name': report.file_name,
            'status': report.status,
            'created_at': report.created_at,
            'updated_at': report.updated_at  
        }
        return Response(data, status=status.HTTP_200_OK)


class DownloadReportFile(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, report_id):
        if checkIsStaff(request.user):
            report = get_object_or_404(ReportRequest, id=report_id)
        else:
            report = get_object_or_404(ReportRequest, id=report_id, user=request.user)

        if report.status != 'completed':
            return Response({'message': f'Report status: {report.status}'}, status=status.HTTP_400_BAD_REQUEST)

        if not report.file_path or not report.file_path.storage.exists(report.file_path.name):
            return Response({'message': 'File not found on server.'}, status=status.HTTP_404_NOT_FOUND)

        download_name = report.file_path.name.split('/')[-1]

        if report.file_name:
            download_name = f"{report.file_name}.csv"
        else:
            download_name = f"report_{report.id}.csv"

        response = FileResponse(
            report.file_path, 
            as_attachment=True, 
            filename=download_name
        )
        return response


class EditFiltersView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, filter_id, user):
        if checkIsStaff(user):
            return get_object_or_404(ReportFilter, id=filter_id)
        return get_object_or_404(ReportFilter, id=filter_id, user=user, is_global=False)

    def get(self, request, filter_id):
        report_filter = self.get_object(filter_id, request.user)
        serializer = ReportFilterSerializer(report_filter)
        return Response(serializer.data)
    
    def patch(self, request, filter_id):
        report_filter = self.get_object(filter_id, request.user)
        serializer = ReportFilterSerializer(report_filter, data=request.data, partial=True)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DeleteReportFilter(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, filter_id):
        query = {'id': filter_id} if checkIsStaff(request.user) else {'id': filter_id, 'user': request.user}
        report_filter = get_object_or_404(ReportFilter, **query)

        active_requests = ReportRequest.objects.filter(
            report_filter_id=filter_id, 
            status__in=['pending', 'processing']
        )

        if active_requests.exists():
            logger.info(f"User {request.user} deleted filter {filter_id} which had {active_requests.count()} active jobs.")
        
        report_filter.delete()
        
        return Response({'message': 'Filter deleted successfully.'}, status=status.HTTP_200_OK)


class DeleteReport(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, report_id):
        if checkIsStaff(request.user):
            report = get_object_or_404(ReportRequest, id=report_id)
        else:
            report = get_object_or_404(ReportRequest, id=report_id, user=request.user)
        
        report.delete()

        return Response({'message': 'Report deleted successfully.'}, status=status.HTTP_200_OK)