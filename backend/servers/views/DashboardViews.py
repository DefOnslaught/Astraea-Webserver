import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.core.cache import cache

from servers.utils import warm_cache_in_background

logger = logging.getLogger('django')


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = cache.get("dashboard_stats")

        if stats is None:
            warm_cache_in_background()

            return Response({
                "status": "warming",
                "progress": "Cache is populating..."
            }, status=status.HTTP_202_ACCEPTED)
        return Response(stats, status=status.HTTP_200_OK)