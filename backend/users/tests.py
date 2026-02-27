from django.urls import reverse
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .factories import UserFactory

User = get_user_model()

class AuthTests(APITestCase):
    def setUp(self):
        """Set up a base user for login and logout tests."""
        self.user = UserFactory()
        self.password = 'StrongPassword123!'
            
        self.login_url = reverse('token_obtain_pair')
        self.register_url = reverse('auth_register')
        self.logout_url = reverse('logout')
        self.refresh_url = reverse('token_refresh')
        self.logout_all_url = reverse('logout_all_devices')
            
        # Cookie keys from your settings
        self.access_cookie = settings.SIMPLE_JWT['AUTH_COOKIE']
        self.refresh_cookie = settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']

    # --- REGISTRATION TESTS ---
    def test_registration_sets_cookies(self):
        data = {
            "email": "new@test.com",
            "username": "newuser",
            "password": "NewPassword123!",
            "password_confirm": "NewPassword123!"
        }
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn(self.access_cookie, response.cookies)
        self.assertTrue(response.cookies[self.access_cookie]['httponly'])

    def test_registration_password_mismatch(self):
        data = {
            "email": "unique_email@test.com",
            "username": "unique_guy",
            "password": "Password1!",
            "password_confirm": "DifferentPassword2!"
        }
        
        response = self.client.post(self.register_url, data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], "An account with this email/username already exists or the data is invalid.")

    # --- LOGIN TESTS ---
    
    def test_login_success_sets_cookies(self):
        data = {"email": self.user.email, "password": self.password}
        response = self.client.post(self.login_url, data)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(self.access_cookie, response.cookies)
        self.assertEqual(response.data['message'], "Login Success")

    def test_login_invalid_credentials(self):
        data = {
            "email": self.user.email,
            "password": "WrongPassword"
        }
        response = self.client.post(self.login_url, data)
        # Your custom view returns 406_NOT_ACCEPTABLE on failure
        self.assertEqual(response.status_code, status.HTTP_406_NOT_ACCEPTABLE)
    
    # --- AUTHENTICATION & REFRESH ---
    def test_access_protected_route_with_cookie(self):
        """Verifies CustomJWTAuthentication reads the access cookie correctly."""
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies[self.access_cookie] = str(refresh.access_token)
        
        url = reverse('basic-info')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.user.email)

    def test_token_refresh_via_cookie(self):
        """Verifies CustomTokenRefreshView uses the refresh cookie to issue new tokens."""
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies[self.refresh_cookie] = str(refresh)
        
        response = self.client.post(self.refresh_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(self.access_cookie, response.cookies)
        self.assertEqual(response.data['message'], "Token refreshed")
    
    # --- COOKIE AUTHENTICATION TESTS ---
    def test_access_protected_route_with_cookie(self):
        """Verifies CustomJWTAuthentication works with cookies"""
        refresh = RefreshToken.for_user(self.user)
        access_token = str(refresh.access_token)
        
        # Manually set the cookie in the test client
        self.client.cookies[self.access_cookie] = access_token
        
        url = reverse('basic-info')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], self.user.email)

    # --- LOGOUT TESTS ---
    def test_logout_clears_cookies_and_blacklists(self):
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies[self.access_cookie] = str(refresh.access_token)
        self.client.cookies[self.refresh_cookie] = str(refresh)
        
        response = self.client.post(self.logout_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check that cookies are cleared
        self.assertEqual(response.cookies[self.access_cookie].value, "")
        
        # Verify the refresh token is dead (if using CustomTokenRefreshView)
        self.client.cookies[self.refresh_cookie] = str(refresh)
        res_refresh = self.client.post(self.refresh_url)
        self.assertEqual(res_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    
    def test_logout_without_token_is_silent_success(self):
        # Log the user in via session/force_authenticate so they hit the view
        self.client.force_authenticate(user=self.user)
        
        # Ensure NO refresh cookie is present
        if self.refresh_cookie in self.client.cookies:
            del self.client.cookies[self.refresh_cookie]

        response = self.client.post(self.logout_url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], "Logged out")

    
    def test_logout_all_devices(self):
        refresh1 = RefreshToken.for_user(self.user)
        refresh2 = RefreshToken.for_user(self.user)

        # Authenticate with cookie for "device 1"
        self.client.cookies[self.access_cookie] = str(refresh1.access_token)
        response = self.client.post(self.logout_all_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Try to refresh with "device 2's" cookie - should fail because it's blacklisted
        self.client.cookies[self.refresh_cookie] = str(refresh2)
        res = self.client.post(self.refresh_url)
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # --- PROTECTED ROUTE TESTS ---
    def test_basic_info_requires_auth(self):
        url = reverse('basic-info')
        # Request without credentials
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)