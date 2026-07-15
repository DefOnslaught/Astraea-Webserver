from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.core.cache import cache
from django.contrib.auth import get_user_model
from unittest.mock import patch, MagicMock

User = get_user_model()

class UserAccountsTests(APITestCase):
    
    def setUp(self):
        cache.clear()
        
        # Admin/Staff user
        self.admin = User.objects.create_superuser(
            email="admin@test.com", username="admin", password="password123"
        )
        # Regular user
        self.regular_user = User.objects.create_user(
            email="user@test.com", username="regular", password="password123"
        )
        # Target user for testing patch/inspect
        self.target_user = User.objects.create_user(
            email="target@test.com", username="target", password="password123"
        )

        self.client.force_authenticate(user=self.admin)

    def test_fetch_users_unauthorized(self):
        self.client.force_authenticate(user=self.regular_user)
        response = self.client.get(reverse('fetch_users'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_fetch_users_authorized(self):
        response = self.client.get(reverse('fetch_users'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2) # Should include admin and others

    def test_inspect_user_success(self):
        response = self.client.get(reverse('inspect_user', kwargs={'username': 'target'}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'target')

    def test_patch_user_password_validation(self):
        # Testing weak password (assuming password_validation is active)
        data = {'password': '123'} 
        response = self.client.patch(reverse('inspect_user', kwargs={'username': 'target'}), data)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patch_user_self_edit_forbidden(self):
        data = {'email': 'new@email.com'}
        # Trying to patch own account
        response = self.client.patch(reverse('inspect_user', kwargs={'username': 'admin'}), data)
        self.assertEqual(response.status_code, status.HTTP_406_NOT_ACCEPTABLE)

    def test_create_user_success(self):
        data = {
            "email": "newuser@test.com",
            "username": "newuser",
            "password": "StrongPassword123!",
            "password_confirm": "StrongPassword123!"
        }
        response = self.client.post(reverse('create_user'), data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="newuser").exists())


class ServerMaintenanceTests(APITestCase):
    
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_superuser(username="admin", password="password", email="test@example.com")
        self.client.force_authenticate(user=self.user)

    def test_refresh_cache_post(self):
        url = reverse('refresh_cache')
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['message'], 'Cache refresh initiated in background.')

    @patch('administration.views.ServerMaintenance.current_app.control.inspect')
    def test_celery_monitoring_get(self, mock_inspect):
        # Setup mock inspector
        mock_instance = MagicMock()
        mock_instance.stats.return_value = {'worker1': {'uptime': 100}}
        mock_instance.active.return_value = {'worker1': [{'id': '1', 'name': 'task1'}]}
        mock_inspect.return_value = mock_instance

        url = reverse('celery_stats')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_workers'], 1)
        self.assertEqual(response.data['active_tasks'][0]['name'], 'task1')

    @patch('administration.views.ServerMaintenance.subprocess.run')
    def test_system_stats_get(self, mock_run):
        # Mocking systemctl and shell commands
        mock_run.return_value = MagicMock(stdout="active\n", returncode=0)
        
        # We need to configure specific return values for the sequence of calls in SystemStatsView
        # 1. services, 2. uptime, 3. disk, 4. memory
        mock_run.side_effect = [
            MagicMock(stdout="active"), # nginx
            MagicMock(stdout="active"), # gunicorn
            MagicMock(stdout="active"), # redis
            MagicMock(stdout="active"), # beat
            MagicMock(stdout="active"), # worker
            MagicMock(stdout="Filesystem\n/dev/sda 10G 5G 5G 50% /"), # df
            MagicMock(stdout="total used free\nMem: 1000 500 500"), # free
        ]

        url = reverse('system_stats')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_system_logs_invalid_type(self):
        url = reverse('system_logs', kwargs={'log_type': 'nonexistent'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)