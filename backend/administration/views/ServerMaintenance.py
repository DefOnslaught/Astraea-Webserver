import logging, subprocess, os, zipfile, io, psutil, time, requests
from datetime import timedelta
from packaging import version
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from celery import current_app
from django_celery_beat.models import PeriodicTask
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.conf import settings
from django.utils import timezone
from django.http import FileResponse, HttpResponse
from django.db import connections, connection

from administration.models import AgentUpdateCheck, UpdateCheck
from administration.utils import get_version, normalize_version
from users.permissions import checkIsStaff
from administration.tasks import run_cache_refresh_task
from reports.tasks import delete_all_reports
from servers.models import Package, PatchSession
from servers.utils import refresh_package_search_index
from configuration.utils import get_agent_version
from configuration.models import AstraeaAgentInfo

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
                "check-if-site-outdated": "configuration.tasks.check_if_site_outdated",
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

        uptime_seconds = time.time() - psutil.boot_time()
        td = timedelta(seconds=int(uptime_seconds))
        days = td.days
        hours = td.seconds // 3600
        minutes = (td.seconds % 3600) // 60
        uptime_str = f"{days}d {hours}h {minutes}m" if days > 0 else f"{hours}h {minutes}m"

        disk = psutil.disk_usage('/')
        
        virtual_mem = psutil.virtual_memory()
        total_mb = virtual_mem.total // (1024 * 1024)
        used_mb = virtual_mem.used // (1024 * 1024)

        cpu_percent = psutil.cpu_percent(interval=0.1) 
        try:
            load_1, load_5, load_15 = os.getloadavg()
        except (AttributeError, OSError):
            load_1, load_5, load_15 = 0.0, 0.0, 0.0

        stats = {
            'services': {},
            'uptime': uptime_str,
            'disk_usage': f"{disk.percent}%",
            'memory': f"{used_mb}MB / {total_mb}MB",
            'migrations': 'Up to date',
            'cpu_usage': f"{cpu_percent}%",
            'load_avg': f"{load_1:.2f}, {load_5:.2f}, {load_15:.2f}",
            'raw_metrics': {
                'cpu_percent': cpu_percent,
                'memory_percent': virtual_mem.percent,
                'disk_percent': disk.percent,
                'load_averages': [load_1, load_5, load_15]
            }
        }
        for service in ['nginx', 'gunicorn', 'redis-server', 'astraea-beat', 'astraea-worker']:
            res = subprocess.run(['systemctl', 'is-active', service], capture_output=True, text=True)
            stats['services'][service] = res.stdout.strip()

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


class PurgeDatabaseOldPackagesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            orphaned_packages = Package.objects.filter(usage_history__isnull=True)
            
            count = orphaned_packages.count()
            
            orphaned_packages.delete()

            refresh_package_search_index()

            if settings.DEBUG:
                logger.info(f"Database Purge: Removed {count} orphaned packages.")
            
            return Response({
                'message': f'Successfully purged {count} orphaned packages.',
                'purged_count': count
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f'Database purge failed: {str(e)}')
            return Response({
                'message': f'Internal server error during purge: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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


class DeletePatchHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, days):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            days = int(days)
            if days <= 0:
                return Response({'message': 'Days parameter must be a positive integer.'}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError:
            return Response({'message': 'Invalid days parameter.'}, status=status.HTTP_400_BAD_REQUEST)

        cutoff_date = timezone.now() - timedelta(days=days)


        old_sessions = PatchSession.objects.filter(timestamp__lt=cutoff_date)
        sessions_deleted_count, _ = old_sessions.delete()

        orphaned_packages = Package.objects.filter(usage_history__isnull=True)
        packages_deleted_count, _ = orphaned_packages.delete()

        if settings.DEBUG:
                logger.info(f"'{request.user.username}' successfully purged history older than {days} days.")

        return Response({
            'message': f'Successfully purged history older than {days} days.',
            'records_deleted': {
                'sessions_and_updates': sessions_deleted_count,
                'orphaned_packages': packages_deleted_count
            }
        }, status=status.HTTP_200_OK)


class CheckUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        REPO_OWNER = "DefOnslaught"
        REPO_NAME = "Astraea-Webserver"
        RELEASE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"

        try:
            update, _ = UpdateCheck.objects.get_or_create(id=1)
            raw_current = get_version()
            now = timezone.now()
            raw_latest = None
            
            if update.last_checked_at and (now - update.last_checked_at) < timedelta(hours=1):
                raw_latest = update.latest_version_on_github
            else:
                response = requests.get(RELEASE_URL, timeout=10)
                response.raise_for_status()
                release_data = response.json()
                raw_latest = release_data.get('tag_name')

                update.latest_version_on_github = raw_latest
                update.last_checked_at = now
                update.save()
            
            current_version = normalize_version(raw_current)
            latest_version = normalize_version(raw_latest)
            update_available = version.parse(latest_version) > version.parse(current_version)

            return Response({'current_version': current_version, 'latest_version': latest_version, 'update_available': update_available}, status=status.HTTP_200_OK)
        
        except requests.exceptions.RequestException as e:
            logger.error(f"GitHub API check failed: {str(e)}")
            return Response({'message': 'Failed to reach GitHub to check for updates.'}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            logger.error(f"Error checking for Astraea Webserver updates: {str(e)}")
            return Response({'message': 'An internal error occurred while checking for updates.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CheckAgentUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        REPO_OWNER = "DefOnslaught"
        REPO_NAME = "Astraea-Agent"
        RELEASE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"

        try:
            raw_current = get_agent_version()

            update_status, _ = AgentUpdateCheck.objects.get_or_create(id=1)
            now = timezone.now()
            raw_latest = None
            if update_status.last_checked_at and (now - update_status.last_checked_at) < timedelta(hours=1):
                raw_latest = update_status.latest_version_on_github
            else:
                response = requests.get(RELEASE_URL, timeout=10)
                response.raise_for_status()
                release_data = response.json()
                raw_latest = release_data.get('tag_name')

                update_status.latest_version_on_github = raw_latest
                update_status.last_checked_at = now
                update_status.save()

            current_version = normalize_version(raw_current)
            latest_version = normalize_version(raw_latest)
            update_available = version.parse(latest_version) > version.parse(current_version)

            return Response({'current_version': current_version, 'latest_version': latest_version, 'update_available': update_available}, status=status.HTTP_200_OK)

        except requests.exceptions.RequestException as e:
            logger.error(f"GitHub API check failed: {str(e)}")
            return Response({'message': 'Failed to reach GitHub to check for agent updates.'}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as e:
            logger.error(f"Error checking for Astraea Agent updates: {str(e)}")
            return Response({'message': 'An internal error occurred while checking for agent updates.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UpdateAgentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        REPO_OWNER = "DefOnslaught"
        REPO_NAME = "Astraea-Agent"
        RELEASE_URL = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"
        
        update_status, _ = AgentUpdateCheck.objects.get_or_create(id=1)
        now = timezone.now()
        raw_latest = None
        release_data = None
        if update_status.last_checked_at and (now - update_status.last_checked_at) < timedelta(hours=1):
            raw_latest = update_status.latest_version_on_github
        else:
            try:
                response = requests.get(RELEASE_URL, timeout=10)
                response.raise_for_status()
                release_data = response.json()
                raw_latest = release_data.get('tag_name')
                
                update_status.latest_version_on_github = raw_latest
                update_status.last_checked_at = now
                update_status.save()
            except Exception as e:
                logger.error(f"GitHub API check failed: {str(e)}")
                return Response({'message': 'Failed to reach GitHub.'}, status=status.HTTP_502_BAD_GATEWAY)

        current_version = normalize_version(get_agent_version())
        latest_version = normalize_version(raw_latest)

        if version.parse(current_version) >= version.parse(latest_version):
            return Response({'message': "Up to date"}, status=status.HTTP_200_OK)

        if not release_data:
             response = requests.get(RELEASE_URL, timeout=10)
             release_data = response.json()

        STORAGE_DIR = os.path.join(settings.BASE_DIR, 'protected_storage')
        os.makedirs(STORAGE_DIR, exist_ok=True)
        AGENT_FILE = 'astraea_agent.tar.gz'
        AGENT_PATH = os.path.join(STORAGE_DIR, AGENT_FILE)

        try:
            assets = release_data.get('assets', [])
            asset = next((a for a in assets if a['name'] == AGENT_FILE), None)
            if not asset:
                return Response({'message': 'Asset not found in release'}, status=status.HTTP_404_NOT_FOUND)

            download_url = asset['browser_download_url']
            file_response = requests.get(download_url, stream=True, timeout=30)
            file_response.raise_for_status()
            
            with open(AGENT_PATH, 'wb') as f:
                for chunk in file_response.iter_content(chunk_size=8192):
                    f.write(chunk)

            AstraeaAgentInfo.objects.update_or_create(id=1, defaults={'version': latest_version})

            if settings.DEBUG:
                logger.info(f"Updated Agent to version {latest_version}")
            
            return Response({'message': f"Updated Agent to version {latest_version}"}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Failed to update Astraea Agent. {str(e)}")
            return Response({'message': 'Failed to update Astraea Agent.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)