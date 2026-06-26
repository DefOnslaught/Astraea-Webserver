import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from celery.app.control import Inspect
from celery import current_app
from django_celery_beat.models import PeriodicTask
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError
from django.db import transaction
from django.core.cache import cache
from django.conf import settings
from django.utils import timezone

from .serializers import UserSerializer
from users.serializers import RegisterSerializer
from users.permissions import checkIsStaff, checkIfHigherPermissions
from .tasks import run_cache_refresh_task

logger = logging.getLogger('django')
User = get_user_model()

class FetchUsers(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        try:
            users = User.objects.all().order_by('-date_joined')
            serializer = UserSerializer(users, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unable to fetch users. {str(e)}")
            return Response({'message': 'Internal server error fetching user list.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class InspectUser(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, username):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            user = get_object_or_404(User.objects.select_related('verification'), username=username)
            serializer = UserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unable to load user data. {str(e)}")
            return Response({'message': 'Internal server error loading user data.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

    def patch(self, request, username):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        if request.user.username == username:
            return Response({'message': 'Cannot edit your own account'}, status=status.HTTP_406_NOT_ACCEPTABLE)

        user = get_object_or_404(User.objects.select_related('verification'), username=username)
        new_password = request.data.get('password')

        if checkIfHigherPermissions(request, user):
            return Response({'message': 'Unable to modify accounts with higher permissions'}, status=status.HTTP_406_NOT_ACCEPTABLE)
        
        if request.data.get('is_superuser') and not request.user.is_superuser:
            return Response({'message': 'Only superusers can promote others to superuser status.'}, status=status.HTTP_403_FORBIDDEN)
        
        if new_password:
            try:
                password_validation.validate_password(new_password, user=user)
            except ValidationError as e:
                return Response({'message': e.messages[0]}, status=status.HTTP_400_BAD_REQUEST)

        serializer = UserSerializer(user, data=request.data, partial=True)
        
        if serializer.is_valid():
            try:
                with transaction.atomic():
                    if new_password:
                        user.set_password(new_password)
                        user.save()
                    
                    serializer.save()
                    logger.info(f"Successfully updated user `{username}`")
                    return Response(serializer.data, status=status.HTTP_200_OK)
            except Exception as e:
                logger.error(f"Error updating user: {str(e)}")
                return Response({'message': 'Internal server error processing update'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        logger.error(f"Error updating user: {serializer.errors}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CreateNewUser(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not checkIsStaff(request.user):
            return Response({'message': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = serializer.save()
                return Response({
                    'message': f'Account for {user.username} created successfully.',
                    'id': user.id
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Unable create new user. {str(e)}")
                return Response({'message': 'Internal server error during user creation.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
                "reconcile-pending-notifications": "notifications.tasks.reconcile_task_path",
                "check-outdated-servers": "notifications.tasks.notify_out_of_date",
                "delete-expired-password-resets": "users.tasks.remove_expired_password_resets",
                "cleanup-old-notifications": "notifications.tasks.delete_sent_notifications",
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