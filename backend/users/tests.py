from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .factories import UserFactory

User = get_user_model()

class AuthTests(APITestCase):
    def setUp(self):
        """Set up a base user for login and logout tests."""
        # Create a user for login/logout tests automatically
        self.user = UserFactory() 
        # We know the password because it's set in the factory
        self.password = 'StrongPassword123!'
        
        self.login_url = reverse('token_obtain_pair')
        self.register_url = reverse('auth_register')
        self.logout_url = reverse('logout')

    # --- REGISTRATION TESTS ---
    def test_registration_success(self):
        data = {
            "email": "newuser@astraea.com",
            "username": "newuser",
            "password": "NewPassword123!",
            "password_confirm": "NewPassword123!"
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertTrue(User.objects.filter(email=data["email"]).exists())

    def test_registration_password_mismatch(self):
        # This request is guaranteed to have a unique username/email
        data = {
            "email": "unique_email@test.com",
            "username": "unique_guy",
            "password": "Password1!",
            "password_confirm": "DifferentPassword2!"
        }
        
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message']['password'][0], "Password fields didn't match.")

    # --- LOGIN TESTS ---
    def test_login_success(self):
        data = {
            "email": self.user.email,
            "password": self.password
        }
        response = self.client.post(self.login_url, data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_invalid_credentials(self):
        data = {
            "email": self.user.email,
            "password": "WrongPassword"
        }
        response = self.client.post(self.login_url, data)
        # Your custom view returns 406_NOT_ACCEPTABLE on failure
        self.assertEqual(response.status_code, status.HTTP_406_NOT_ACCEPTABLE)

    # --- LOGOUT TESTS ---
    def test_logout_blacklist_success(self):
        # 1. Manually generate a refresh token for the user
        refresh = RefreshToken.for_user(self.user)
        
        # 2. Authenticate the request (LogoutView requires IsAuthenticated)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
        
        # 3. Hit the logout endpoint
        response = self.client.post(self.logout_url, {"refresh": str(refresh)})
        
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

    def test_logout_without_token_fails(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(self.logout_url, {}) # Empty payload
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_logout_all_devices(self):
        # 1. Simulate logging in from two different "devices"
        refresh1 = RefreshToken.for_user(self.user)
        refresh2 = RefreshToken.for_user(self.user)

        # 2. Call the Logout All view (need to add the name to your urls.py if not there)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh1.access_token}')
        url = reverse('logout_all_devices') # Make sure this matches your urls.py name!
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_205_RESET_CONTENT)

        # 3. Verify BOTH refresh tokens are now blacklisted
        # We try to use them to refresh and they should fail
        refresh_url = reverse('token_refresh')
        
        res1 = self.client.post(refresh_url, {"refresh": str(refresh1)})
        res2 = self.client.post(refresh_url, {"refresh": str(refresh2)})

        self.assertEqual(res1.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res2.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- PROTECTED ROUTE TESTS ---
    def test_basic_info_requires_auth(self):
        url = reverse('basic-user-info')
        # Request without credentials
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)