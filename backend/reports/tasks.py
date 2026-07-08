import logging, csv, io
from celery import shared_task
from django.conf import settings
from datetime import timedelta
from django.utils import timezone
from django.core.files.base import ContentFile
from django.core.exceptions import FieldError, ValidationError
from django.utils.text import get_valid_filename
from django.db.models import Max
from django.core.cache import cache

from .models import ReportRequest
from servers.models import Server, PatchSession
from .utils import process_dynamic_criteria

logger = logging.getLogger('django')

@shared_task(bind=True, max_retries=3)
def generate_dynamic_report_task(self, report_request_id):
    try:
        report = ReportRequest.objects.get(id=report_request_id)
        report.status = 'processing'
        report.save(update_fields=['status', 'updated_at'])

        fields = report.selected_fields or ['hostname', 'env', 'os_version']
        criteria = report.applied_criteria.copy()
        only_latest = criteria.pop('only_latest_session', False)

        criteria = process_dynamic_criteria(criteria)

        is_session_query = (
            any(f.startswith('patch_sessions__') for f in fields) or 
            any(k.startswith('patch_sessions__') for k in criteria.keys()) or
            only_latest
        )

        if is_session_query:
            mapped_fields = []
            for f in fields:
                if f.endswith('timestamp'):
                    mapped_fields.append('timestamp')
                elif f.startswith('patch_sessions__'):
                    mapped_fields.append(f.replace('patch_sessions__', '', 1))
                else:
                    mapped_fields.append(f"server__{f}")
            
            session_criteria = {}
            server_criteria = {}
            
            for k, v in criteria.items():
                if k.startswith('patch_sessions__'):
                    clean_key = k.replace('patch_sessions__', '', 1)
                    session_criteria[clean_key] = v
                elif k == 'only_latest_session':
                    continue
                else:
                    server_criteria[f"server__{k}"] = v
            
            queryset = PatchSession.objects.filter(**session_criteria, **server_criteria)

            if only_latest:
                latest_pks = PatchSession.objects.filter(
                    **session_criteria, 
                    **server_criteria
                ).values('server_id').annotate(
                    latest_id=Max('id')
                ).values_list('latest_id', flat=True)
                
                queryset = queryset.filter(pk__in=latest_pks)
            
            data_qs = queryset.values_list(*mapped_fields)
        else:
            queryset = Server.objects.filter(**criteria)
            data_qs = queryset.values_list(*fields)

        csv_buffer = io.StringIO()
        writer = csv.writer(csv_buffer)
        
        headers = [f.replace('__', ' ').replace('_', ' ').title() for f in fields]
        writer.writerow(headers)

        for row in data_qs.iterator(chunk_size=5000):
            formatted_row = [
                val.strftime("%Y-%m-%d %H:%M:%S") if hasattr(val, 'strftime') else (val if val is not None else "")
                for val in row
            ]
            writer.writerow(formatted_row)
        
        unique_suffix = str(report.id)[:8]
        if report.file_name:
            raw_safe_name = get_valid_filename(report.file_name)
            clean_name = raw_safe_name.strip('_').strip()
            safe_name = clean_name[:60].strip('_')
            final_base_name = f"{safe_name}_{unique_suffix}"
        else:
            final_base_name = f"report_{unique_suffix}"
            
        file_name = f"{final_base_name}.csv"
        
        report.file_path.save(file_name, ContentFile(csv_buffer.getvalue().encode('utf-8')))
        
        report.status = 'completed'
        report.save(update_fields=['status', 'file_path', 'updated_at'])
        
        if settings.DEBUG:
            logger.info(f"Successfully saved report {report.id} for user {report.user.username}")

    except (FieldError, ValidationError, ValueError) as query_err:
        if 'report' in locals():
            report.status = 'failed'
            report.save(update_fields=['status', 'updated_at'])
        logger.error(f"Query compilation error processing report {report_request_id}: {str(query_err)}")

    except Exception as general_err:
        if 'report' in locals():
            try:
                raise self.retry(exc=general_err, countdown=60)
            except self.MaxRetriesExceededError:
                report.status = 'failed'
                if report.file_path:
                    report.file_path.delete(save=False)
                report.save(update_fields=['status', 'updated_at'])
        logger.error(f"Critical error processing report task {report_request_id}: {str(general_err)}")


@shared_task(name="reports.tasks.delete_old_reports")
def delete_old_reports():
    threshold_time = timezone.now() - timedelta(hours=24)
    expired_reports = ReportRequest.objects.filter(created_at__lt=threshold_time)

    total_deleted = 0

    while True:
        report_ids = list(expired_reports.values_list('id', flat=True)[:1000])
        if not report_ids:
            break
            
        deleted_count, _ = ReportRequest.objects.filter(id__in=report_ids).delete()
        total_deleted += deleted_count
    
    if settings.DEBUG:
        if total_deleted > 0:
            logger.info(f"Cleanup finished: {total_deleted} expired reports and files removed.")


@shared_task()
def delete_all_reports():
    try:
        for report in ReportRequest.objects.all().iterator(chunk_size=1000):
            report.delete()
            
    finally:
        cache.delete('is_deleting_all_reports')