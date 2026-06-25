from django.urls import reverse
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from .factories import UserFactory
from configuration.models import SysConfig

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
        self.session_extend_url = reverse('session-extend')
            
        # Cookie keys from your settings
        self.access_cookie = settings.SIMPLE_JWT['AUTH_COOKIE']
        self.refresh_cookie = settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH']

        SysConfig.objects.create(
            patching_enabled=True, 
            skip_email_validation=True, 
            disable_registration=False
        )

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


    def test_get_user_profile(self):
        url = reverse('user-profile')

        refresh = RefreshToken.for_user(self.user)
        self.client.cookies[self.access_cookie] = str(refresh.access_token)

        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], self.user.username)
        self.assertEqual(response.data['email'], self.user.email)


    def test_update_user_profile(self):
        url = reverse('user-profile')
        
        refresh = RefreshToken.for_user(self.user)
        self.client.cookies[self.access_cookie] = str(refresh.access_token)

        new_data = {'username': 'new_awesome_username'}        
        
        response = self.client.put(url, data=new_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, 'new_awesome_username')
        self.assertEqual(response.data['username'], 'new_awesome_username')


    def test_change_password_success(self):
        url = reverse('change-password')
        self.client.cookies[self.access_cookie] = str(RefreshToken.for_user(self.user).access_token)
    
        data = {
            "old_password": "StrongPassword123!",
            "new_password": "New-Secure-Password-2026!"
        }
        
        response = self.client.put(url, data=data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("New-Secure-Password-2026!"))


    def test_change_password_invalid_old_password(self):
        url = reverse('change-password')
        self.client.cookies[self.access_cookie] = str(RefreshToken.for_user(self.user).access_token)
    
        data = {
            "old_password": "WrongCurrentPassword123!",
            "new_password": "New-Secure-Password-2026!"
        }
        
        response = self.client.put(url, data=data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        self.assertIn('old_password', response.data)
        self.assertEqual(response.data['old_password'][0], "Old password is not correct.")
        
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("StrongPassword123!"))
    

    def test_session_extend_success(self):
        """
        HAPPY PATH: Valid user with a valid refresh token cookie.
        Checks: 200 OK, New cookies set, Old token blacklisted.
        """
        # 1. Generate initial tokens
        refresh = RefreshToken.for_user(self.user)
        refresh_token_str = str(refresh)
        
        # 2. Authenticate the request
        self.client.force_authenticate(user=self.user)
        self.client.cookies[self.refresh_cookie] = refresh_token_str

        response = self.client.post(self.session_extend_url)

        # Assertions
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(self.access_cookie, response.cookies)
        self.assertIn(self.refresh_cookie, response.cookies)
        
        # Verify blacklisting (Requires 'rest_framework_simplejwt.token_blacklist' in INSTALLED_APPS)
        is_blacklisted = BlacklistedToken.objects.filter(token__token=refresh_token_str).exists()
        self.assertTrue(is_blacklisted, "The old refresh token should be blacklisted after renewal.")

    def test_session_extend_no_cookie(self):
        """
        FAILURE: Authenticated user but missing the refresh token cookie.
        """
        self.client.force_authenticate(user=self.user)
        # We explicitly don't set the refresh cookie here
        
        response = self.client.post(self.session_extend_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], "No refresh token provided")

    def test_session_extend_invalid_token(self):
        """
        FAILURE: Refresh token cookie exists but is malformed or tampered with.
        """
        self.client.force_authenticate(user=self.user)
        self.client.cookies[self.refresh_cookie] = "this-is-not-a-valid-jwt-string"

        response = self.client.post(self.session_extend_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], "Invalid session")

    def test_session_extend_unauthenticated(self):
        """
        FAILURE: User is not logged in (Permission Denied).
        """
        response = self.client.post(self.session_extend_url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_session_extend_expired_token(self):
        """
        FAILURE: Refresh token has expired.
        """
        self.client.force_authenticate(user=self.user)
        
        refresh = RefreshToken.for_user(self.user)
        refresh.blacklist()
        
        self.client.cookies[self.refresh_cookie] = str(refresh)
        response = self.client.post(self.session_extend_url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)