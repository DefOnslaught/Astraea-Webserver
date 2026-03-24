from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.core.cache import cache
from django.contrib.auth import get_user_model

from .models import APIKey

User = get_user_model()

class ConfigurationTests(APITestCase):

    def setUp(self):
        cache.clear()

        self.user = User.objects.create_user(
            email="test@example.com", 
            username="testuser", 
            password="password123"
        )
        self.client.force_authenticate(user=self.user)

    def test_create_api_key_success(self):
        """Verify authenticated users can generate an API key and it's in the DB."""
        url = reverse('create_api_key')
        data = {"name": "Production-Cluster-01"}

        # 1. Act: Create the key
        response = self.client.post(url, data, format='json')

        # 2. Assertions for Response
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('key', response.data)
        self.assertEqual(response.data['name'], "Production-Cluster-01")

        # 3. Assertions for Database
        # Verify the plain key in the database
        key = response.data['key']
        self.assertTrue(APIKey.objects.filter(key=key).exists())

    def test_create_api_key_unauthenticated_denied(self):
        """Verify unauthenticated users cannot create API keys."""
        self.client.force_authenticate(user=None)
        url = reverse('create_api_key')
        
        response = self.client.post(url, {"name": "Hacker-Key"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
