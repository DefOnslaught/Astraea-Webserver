import logging, subprocess, os, zipfile, io
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from celery import current_app
from django_celery_beat.models import PeriodicTask
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone
from django.http import FileResponse, HttpResponse
from django.db import connections, connection

from users.permissions import checkIsStaff
from administration.tasks import run_cache_refresh_task
from reports.tasks import delete_all_reports

logger = logging.getLogger('django')
User = get_user_model()

class RefreshCacheView(APIView):
    permission_classes = [IsAuthenticated]

    def _is_staff_and_not_busy(self, user):
        if not checkIsStaff(user):
            return {'allowed': False, 'message': 'Unauthorized', 'status': status.HTTP_403_FORBIDDEN}
        if cache.get('is_refreshing_cache'):
            return {'allowed': False, 'message': 'Refresh already in progress.', 'status': status.HTTP_429_TOO_MANY_REQUESTS}
        return {'allowed': True}

    def get(self, request):
        status_check = self._is_staff_and_not_busy(request.user)
        if not status_check['allowed']:
            return Response({'message': status_check['message']}, status=status_check['status'])
        
        return Response({'can_refresh': True}, status=status.HTTP_200_OK)
    
    def post(self, request):
        status_check = self._is_staff_and_not_busy(request.user)
        if not status_check['allowed']:
            return Response({'message': status_check['message']}, status=status_check['status'])

        cache.set('is_refreshing_cache', True, timeout=600)
        run_cache_refresh_task.delay()

        if settings.DEBUG:
            logger.info(f'Cache refresh initiated in background by `{request.user.username}`')
        
        return Response({'message': 'Cache refresh initiated in background.'})


class CeleryMonitoringView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        data = cache.get('celery_monitoring_data')
        if data:
            return Response(data)

        inspector = current_app.control.inspect(timeout=0.5)
        stats = inspector.stats() or {}
        active_tasks_dict = inspector.active() or {}
        
        active_tasks_list = []
        for worker, tasks in active_tasks_dict.items():
            for task in tasks:
                active_tasks_list.append({
                    'id': task['id'],
                    'name': task['name'],
                    'worker': worker
                })

        workers_data = []
        for worker_name, stat in stats.items():
            workers_data.append({
                'name': worker_name,
                'uptime': stat.get('uptime'),
            })

        scheduled_tasks = PeriodicTask.objects.filter(enabled=True).values(
            'name', 'last_run_at', 'enabled'
        )

        response_data = {
            'workers': workers_data,
            'scheduled_tasks': list(scheduled_tasks),
            'active_tasks': active_tasks_list,
            'total_workers': len(workers_data)
        }

        cache.set('celery_monitoring_data', response_data, 30)

        return Response(response_data)

    def post(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        action = request.data.get('action')
        
        # Handle Task Termination
        if action == 'terminate':
            task_id = request.data.get('task_id')
            current_app.control.revoke(task_id, terminate=True, signal='SIGKILL')
            return Response({'message': f'Task {task_id} terminated.'})
        
        # Handle Triggering Scheduled Task
        elif action == 'run':
            task_name = request.data.get('task_name')

            task_map = {
                "failsafe-zabbix-cleanup": "configuration.tasks.failsafe_cleanup_orphans",
                "reconcile-pending-notifications": "notifications.tasks.reconcile_notifications",
                "check-outdated-servers": "notifications.tasks.notify_out_of_date",
                "delete-expired-password-resets": "users.tasks.remove_expired_password_resets",
                "cleanup-old-notifications": "notifications.tasks.delete_sent_notifications",
                "delete-old-reports": "reports.tasks.delete_old_reports",
            }

            full_task_path = task_map.get(task_name)
        
            if full_task_path:
                current_app.send_task(full_task_path)
                task_record = PeriodicTask.objects.filter(name=task_name).first()
                if task_record:
                    task_record.last_run_at = timezone.now()
                    task_record.save()
                    cache.delete('celery_monitoring_data')
                return Response({'message': f'Task {task_name} triggered.'})
            else:
                return Response({'message': 'Task mapping not found'}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response({'message': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)


class DatabaseStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        cached_stats = cache.get("DATABASE_CONNECTION_STATUS")
        if cached_stats:
            return Response(cached_stats, status=status.HTTP_200_OK)

        db_engine = connection.vendor
        stats = {'engine': db_engine, 'data': None}

        try:
            with connections['default'].cursor() as cursor:
                if db_engine == 'postgresql':
                    # Get Postgres stats
                    cursor.execute("""
                        SELECT datname, numbackends, xact_commit, xact_rollback, blks_hit, blks_read 
                        FROM pg_stat_database 
                        WHERE datname = current_database();
                    """)
                    row = cursor.fetchone()
                    if row:
                        stats['data'] = {
                            'connections': row[1],
                            'commits': row[2],
                            'rollbacks': row[3],
                            'cache_hits': row[4],
                            'disk_reads': row[5]
                        }

                elif db_engine == 'mysql':
                    # Get MySQL stats
                    cursor.execute("SHOW STATUS LIKE 'Threads_connected';")
                    threads = cursor.fetchone()
                    cursor.execute("SELECT table_schema, SUM(data_length + index_length) / 1024 / 1024 AS size_mb FROM information_schema.TABLES WHERE table_schema = DATABASE() GROUP BY table_schema;")
                    size = cursor.fetchone()
                    
                    stats['data'] = {
                        'threads_connected': threads[1] if threads else 0,
                        'size_mb': float(size[1]) if size else 0
                    }
                
                else:
                    stats['data'] = None
                    
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        if stats['data']:
            cache.set("DATABASE_CONNECTION_STATUS", stats, timeout=60)

        return Response(stats, status=status.HTTP_200_OK)


class SystemStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        cached_data = cache.get("SYSTEM_STATS")
        if cached_data:
            return Response(cached_data, status=status.HTTP_200_OK)

        stats = {
            'services': {},
            'uptime': '',
            'disk_usage': '',
            'memory': '',
            'migrations': 'Up to date'
        }

        # 1. Check services
        for service in ['nginx', 'gunicorn', 'redis-server', 'astraea-beat', 'astraea-worker']:
            res = subprocess.run(['systemctl', 'is-active', service], capture_output=True, text=True)
            stats['services'][service] = res.stdout.strip()

        # 2. Uptime
        uptime = subprocess.run(['uptime', '-p'], capture_output=True, text=True)
        stats['uptime'] = uptime.stdout.strip()

        # 3. Disk Usage
        disk = subprocess.run(['df', '-h', '/'], capture_output=True, text=True)
        stats['disk_usage'] = disk.stdout.splitlines()[1].split()[4]

        # 4. Memory
        mem = subprocess.run(['free', '-m'], capture_output=True, text=True)
        mem_line = mem.stdout.splitlines()[1].split()
        stats['memory'] = f"{mem_line[2]}MB / {mem_line[1]}MB"

        # 5. Migrations (Check for pending)
        from django.core.management import call_command
        import io
        out = io.StringIO()
        call_command('showmigrations', stdout=out)
        if '[ ]' in out.getvalue():
            stats['migrations'] = 'Pending Migrations Found!'

        cache.set("SYSTEM_STATS", stats, timeout=60)
        return Response(stats, status=status.HTTP_200_OK)


class SystemLogsView(APIView):
    permission_classes = [IsAuthenticated]

    LOG_MAP = {
        'astraea_errors': 'astraea_errors.log',
        'astraea_general': 'astraea_general.log',
        'celery_beat': 'celery-beat.log',
        'celery_worker': 'celery-worker.log',
    }

    def get(self, request, log_type):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        logs_dir = os.path.join(settings.BASE_DIR, 'logs')

        if log_type == 'all':
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w') as zip_file:
                for name, filename in self.LOG_MAP.items():
                    file_path = os.path.join(logs_dir, filename)
                    if os.path.exists(file_path):
                        zip_file.write(file_path, arcname=filename)
            
            zip_buffer.seek(0)
            response = HttpResponse(zip_buffer, content_type='application/zip')
            response['Content-Disposition'] = 'attachment; filename="astraea_all_logs.zip"'
            return response

        log_filename = self.LOG_MAP.get(log_type)
        if not log_filename:
            return Response({'message': 'Invalid log type'}, status=status.HTTP_400_BAD_REQUEST)

        log_path = os.path.join(logs_dir, log_filename)
        
        if not os.path.exists(log_path):
            return Response({'message': 'Log file not found'}, status=status.HTTP_404_NOT_FOUND)

        return FileResponse(
            open(log_path, 'rb'), 
            as_attachment=True, 
            filename=log_filename
        )
    

class DeleteAllReports(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        if cache.get('is_deleting_all_reports'):
            return Response({'message': 'Deletion is already in progress.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        cache.set('is_deleting_all_reports', True, timeout=180)

        delete_all_reports.delay()

        if settings.DEBUG:
            logger.info(f'Deleting all reports in background by `{request.user.username}`')
        
        return Response({'message': 'Deleting all reports in background.'}, status=status.HTTP_200_OK)
    

class ClearAllLogs(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        if cache.get('is_clearing_logs'):
            return Response({'message': 'Log clearing is already in progress.'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        
        cache.set('is_clearing_logs', True, timeout=120)

        try:
            logs_dir = os.path.join(settings.BASE_DIR, 'logs')
            log_files = [
                'astraea_general.log', 
                'astraea_errors.log', 
                'celery-beat.log', 
                'celery-worker.log'
            ]

            for log_file in log_files:
                file_path = os.path.join(logs_dir, log_file)
                with open(file_path, 'w'):
                    pass

            if settings.DEBUG:
                logger.info(f"Log files successfully cleared by `{request.user.username}`")
            
            return Response({'message': 'Log files successfully cleared.'}, status=status.HTTP_200_OK)
        
        finally:
            cache.delete('is_clearing_logs')