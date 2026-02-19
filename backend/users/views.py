import logging
from django.views.decorators.debug import sensitive_post_parameters
from django.utils.decorators import method_decorator
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from .serializers import RegisterSerializer, TokenOPSerializer, UserSerializer

logger = logging.getLogger('django')

class RegisterView(generics.CreateAPIView):
    queryset = None
    permission_classes = (AllowAny,)
    serializer_class = RegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            logger.info(f"New user '{request.data.get('email')}' has been created successfully")
            return Response({
                'message': "User created successfully",
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }, status=status.HTTP_201_CREATED)
        logger.error(f"Error creating new user '{request.data.get('email')}': {str(serializer.errors)}")
        return Response({'message': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)


@method_decorator(sensitive_post_parameters('password'), name='dispatch')
class TokenOPView(TokenObtainPairView):
    serializer_class = TokenOPSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        try:
            serializer.is_valid(raise_exception=True)
            logger.info(f"User '{request.data.get('email')}' has logged in successfully")
        except (InvalidToken, TokenError, Exception):
            return Response(
                {"message": "Invalid email or password"}, 
                status=status.HTTP_406_NOT_ACCEPTABLE
            )

        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response({"error": "Refresh token is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            token = RefreshToken(refresh_token)
            token.blacklist() # Adds the jti to the BlacklistedToken table
            logger.info(f"User '{request.user.email}' logged out successfully.")
            return Response(status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutAllDevicesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        tokens = OutstandingToken.objects.filter(user=request.user)

        for token in tokens:
            BlacklistedToken.objects.get_or_create(token=token)
        
        logger.info(f"User '{request.user.email}' logged out of all devices successfully.")
        return Response({"message": "Successfully logged out of all devices"}, status=status.HTTP_205_RESET_CONTENT)


class BasicUserInfoView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get profile stuff
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # Example for now
    def put(self, request):
        # 'partial=True' allows updating just the username without sending the whole object
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(f"User '{request.user.email}' successfully updated profile.")
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        logger.error(f"Failed to update profile for '{request.user}': {str(serializer.errors)}")
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)