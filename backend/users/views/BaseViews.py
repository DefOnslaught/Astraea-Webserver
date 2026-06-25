from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

class CSRFTokenView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"message": "CSRF cookie set"})