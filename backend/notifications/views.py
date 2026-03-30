import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .discord_utils import send_msg
from .email_utils import send_test_email

logger = logging.getLogger('django')

class TestDiscordService(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = request.data.get('data', {})
        if not payload:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)
        
        name = payload.get('name')
        url = payload.get('url')
        
        result = send_msg(message=f"Testing Astraea Notification Service For `{name}`", url=url)
        
        return Response(result, status=status.HTTP_200_OK)


class TestEmailService(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        payload = request.data.get('data', {})
        if not payload:
            return Response({'message': "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)
        
        name = payload.get('name', 'Unnamed Service')
        additional_recipients = payload.get('recipients', '')

        recipient_list = [request.user.email]
        if additional_recipients:
            extra_list = [r.strip() for r in additional_recipients.split(',') if r.strip()]
            recipient_list.extend(extra_list)

        final_recipients = list(set(filter(None, recipient_list)))
        result = send_test_email(name, final_recipients)
        
        return Response(result, status=status.HTTP_200_OK)