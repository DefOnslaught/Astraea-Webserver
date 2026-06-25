import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.core.cache import cache
from django.db.models import F

from servers.models import Server, PatchSession
from servers.utils import cache_individual_vms, format_duration

logger = logging.getLogger('django')


class InspectServerInfo(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        server_id = request.data.get('server_id') or request.query_params.get('server_id')

        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)

        cache_key = f"server_data:{server_id}"
        data = cache.get(cache_key)

        if data is None:
            server = get_object_or_404(Server.objects.prefetch_related('interfaces'), server_id=server_id)
            cache_individual_vms([server])
            data = cache.get(cache_key)

        recent_sessions = list(PatchSession.objects.filter(server__server_id=server_id).order_by('-timestamp')[:6])
        
        has_more = len(recent_sessions) > 5
        if has_more:
            recent_sessions = recent_sessions[:5]

        data['has_more_history'] = has_more
        data['recent_history'] = [{
            'id': s.id,
            'timestamp': s.timestamp,
            'status': s.status,
            'was_rebooted': s.was_rebooted,
            'total': s.total_updated,
            'duration': format_duration(s.duration),
            'error_log': s.error_log
        } for s in recent_sessions]

        # Add Packages in the inventory
        latest_session = PatchSession.objects.filter(
            server__server_id=server_id,
            status='success'
        ).first()

        if latest_session:
            updates = latest_session.package_details.select_related('package').all()
            data['recent_packages'] = [{
                'name': u.package.name,
                'version': u.new_version,
                'last_seen': latest_session.timestamp
            } for u in updates]
        else:
            data['recent_packages'] = []

        return Response(data, status=status.HTTP_200_OK)


class ServerPatchHistory(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        server_id = request.query_params.get('server_id')
        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            limit = int(request.query_params.get('limit', 10))
            offset = int(request.query_params.get('offset', 0))
        except ValueError:
            limit = 10
            offset = 0

        sessions = PatchSession.objects.filter(
            server__server_id=server_id
        ).order_by('-timestamp')[offset:offset + limit]

        data = [{
            'id': s.id,
            'timestamp': s.timestamp,
            'status': s.status,
            'was_rebooted': s.was_rebooted,
            'total': s.total_updated,
            'duration': format_duration(s.duration),
            'error_log': s.error_log
        } for s in sessions]

        return Response(data, status=status.HTTP_200_OK)


class ServerPackageInventory(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        server_id = request.query_params.get('server_id')
        if not server_id:
            return Response({'message': "Missing Server ID"}, status=status.HTTP_400_BAD_REQUEST)
        
        # 1. Find the absolute latest successful session for this server
        latest_session = PatchSession.objects.filter(
            server__server_id=server_id,
            status='success'
        ).first() # ordering is -timestamp by default in your model

        if not latest_session:
            return Response([])

        # 2. Get only the packages from THAT specific snapshot
        updates = latest_session.package_details.select_related('package').all()

        data = [{
            'name': u.package.name,
            'version': u.new_version,
            'last_seen': latest_session.timestamp
        } for u in updates]

        return Response(sorted(data, key=lambda x: x['name']), status=status.HTTP_200_OK)


class PatchSessionDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        session_id = request.query_params.get('session_id')
        if not session_id:
            return Response({'message': "Missing Session ID"}, status=status.HTTP_400_BAD_REQUEST)

        session = get_object_or_404(PatchSession, id=session_id)
        
        updates = (
            session.package_details
            .select_related('package')
            .exclude(old_version=F('new_version')) 
            .all()
        )

        data = {
            'id': session.id,
            'timestamp': session.timestamp,
            'total_updated': session.total_updated,
            'duration': format_duration(session.duration),
            'status': session.status,
            'was_rebooted': session.was_rebooted,
            'error_log': session.error_log,
            'updates': [{
                'name': u.package.name,
                'old_version': u.old_version,
                'new_version': u.new_version
            } for u in updates]
        }

        return Response(data, status=status.HTTP_200_OK)