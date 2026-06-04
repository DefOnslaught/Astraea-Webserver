from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.core.cache import cache
from django.contrib.auth import get_user_model

from .models import APIKey, SysConfig, NotificationService, NotificationSettings, AgentInstallConfig, AstraeaAgentInfo

User = get_user_model()

class APIKeyTests(APITestCase):

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

    def test_get_api_keys(self):
        """Verify we can retrieve a list of all API keys."""
        # Pre-create a couple of keys
        APIKey.objects.create(name="Key 1", key=APIKey.generate_key())
        APIKey.objects.create(name="Key 2", key=APIKey.generate_key())

        url = reverse('get_api_keys')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        # Check if they are ordered by created_at descending (newest first)
        self.assertEqual(response.data[0]['name'], "Key 2")

    def test_update_api_key_name_and_status(self):
        """Verify we can rename a key and toggle its active status."""
        key = APIKey.objects.create(name="Old Name", key=APIKey.generate_key(), is_active=True)
        url = reverse('update_api_key')
        
        data = {
            "id": key.id,
            "name": "New Shiny Name",
            "is_active": False
        }
        
        response = self.client.patch(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh from DB
        key.refresh_from_db()
        self.assertEqual(key.name, "New Shiny Name")
        self.assertFalse(key.is_active)

    def test_update_api_key_not_found(self):
        """Verify updating a non-existent ID returns 404."""
        url = reverse('update_api_key')
        response = self.client.patch(url, {"id": 9999, "name": "Fail"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_api_key_success(self):
        """Verify we can delete a key by its ID."""
        key = APIKey.objects.create(name="Temporary Key", key=APIKey.generate_key())
        url = reverse('delete_api_key')
        
        response = self.client.delete(url, {"id": key.id}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(APIKey.objects.filter(id=key.id).exists())
        self.assertIn("deleted successfully", response.data['message'])

    def test_delete_api_key_missing_id(self):
        """Verify deleting without an ID returns 400."""
        url = reverse('delete_api_key')
        response = self.client.delete(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

class SysConfigTests(APITestCase):
    
    def setUp(self):
        cache.clear()

        self.user = User.objects.create_user(
            email="test@example.com", 
            username="testuser", 
            password="password123"
        )
        self.client.force_authenticate(user=self.user)

    def test_get_system_config_success(self):
        """Verify we can retrieve the system configuration."""
        # Create a config object to fetch
        SysConfig.objects.create(patching_enabled=True, skip_email_validation=False)
        
        url = reverse('system_config')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Assuming get_sys_config() returns a dict with these keys
        self.assertIn('patching_enabled', response.data)
        self.assertIn('skip_email_validation', response.data)
        self.assertIn('disable_registration', response.data)

    def test_patch_system_config_update_existing(self):
        """Verify we can update an existing config record."""
        SysConfig.objects.create(patching_enabled=True, skip_email_validation=False)
        url = reverse('system_config')
        
        payload = {
            "data": {
                "patching_enabled": False,
                "skip_email_validation": True,
                "disable_registration": False
            }
        }
        
        response = self.client.patch(url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify DB change
        config = SysConfig.objects.first()
        self.assertFalse(config.patching_enabled)
        self.assertTrue(config.skip_email_validation)
        self.assertFalse(config.disable_registration)

    def test_patch_system_config_create_if_not_exists(self):
        """Verify the view creates a config record if none exists during a patch."""
        # Ensure table is empty
        SysConfig.objects.all().delete()
        
        url = reverse('system_config')
        payload = {
            "data": {
                "patching_enabled": True,
                "skip_email_validation": True,
                "disable_registration": False
            }
        }
        
        response = self.client.patch(url, payload, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(SysConfig.objects.count(), 1)

    def test_patch_system_config_missing_data(self):
        """Verify 400 error when 'data' key is missing from payload."""
        url = reverse('system_config')
        # Sending an empty dict instead of {"data": {...}}
        response = self.client.patch(url, {}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], "Missing required data")

    def test_sys_config_unauthorized(self):
        """Verify unauthenticated users are blocked."""
        self.client.force_authenticate(user=None)
        url = reverse('system_config')
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

class NotificationServiceTest(APITestCase):
    
    def setUp(self):
        cache.clear()

        self.user = User.objects.create_user(
            email="test@example.com", 
            username="testuser", 
            password="password123"
        )
        self.client.force_authenticate(user=self.user)

        # URLs - Ensure these names match your urls.py path(..., name='...')
        self.settings_url = reverse('notify_settings')
        self.services_url = reverse('notify_services')

    # --- NotificationSettingsView Tests ---

    def test_get_notification_settings_creates_default(self):
        """Verify GET creates a settings object if none exists."""
        response = self.client.get(self.settings_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['failed']) # Default is True
        self.assertEqual(NotificationSettings.objects.count(), 1)

    def test_patch_notification_settings_success(self):
        """Verify we can toggle triggers via the 'data' wrapper."""
        payload = {
            "data": {
                "failed": False,
                "success": True,
                "partial": False,
                "out_of_date": True
            }
        }
        response = self.client.patch(self.settings_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        settings = NotificationSettings.objects.first()
        self.assertFalse(settings.failed)
        self.assertTrue(settings.success)

    # --- NotificationServicesView Tests ---

    def test_create_discord_service(self):
        """Verify Discord service creation with field mapping."""
        payload = {
            "data": {
                "name": "Ops Discord",
                "type": "discord",
                "discordWebhook": "https://discord.com/api/webhooks/123",
                "active": True
            }
        }
        response = self.client.post(self.services_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(NotificationService.objects.count(), 1)
        
        service = NotificationService.objects.get()
        self.assertEqual(service.url, "https://discord.com/api/webhooks/123")

    def test_create_smtp_service(self):
        """Verify SMTP service creation with recipients mapping."""
        payload = {
            "data": {
                "name": "Admin Email",
                "type": "smtp",
                "recipients": "admin@astraea.io, dev@astraea.io"
            }
        }
        response = self.client.post(self.services_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        service = NotificationService.objects.get(name="Admin Email")
        self.assertEqual(service.recipients, "admin@astraea.io, dev@astraea.io")

    def test_patch_service_toggle_active(self):
        """Verify partial update (toggle active status)."""
        service = NotificationService.objects.create(
            name="Test Service", type="discord", active=True
        )
        payload = {
            "data": {
                "id": str(service.id), # UUIDs must be strings in JSON
                "active": False
            }
        }
        response = self.client.patch(self.services_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        service.refresh_from_db()
        self.assertFalse(service.active)

    def test_delete_service_success(self):
        """Verify service deletion using the 'data' wrapper."""
        service = NotificationService.objects.create(name="Delete Me", type="slack")
        payload = {
            "data": {
                "id": str(service.id)
            }
        }
        response = self.client.delete(self.services_url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(NotificationService.objects.filter(id=service.id).exists())

    def test_missing_data_wrapper_returns_400(self):
        """Verify 400 error if payload doesn't contain 'data' key."""
        response = self.client.post(self.services_url, {"name": "Bad Payload"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['message'], "Missing required data")

class AgentHandlerTests(APITestCase):
    
    def setUp(self):
        cache.clear()

        self.user = User.objects.create_user(
            email="test@example.com", 
            username="testuser", 
            password="password123"
        )
        self.client.force_authenticate(user=self.user)
    
    def test_create_agent_config_success(self):
        """Verify successful agent config creation with all new agent parameters explicitly defined."""
        api_key = APIKey.objects.create(
            name="Test-Key-01", 
            key="test_secret_123", 
            is_active=True
        )

        url = reverse('agent_create_config')
        
        # Explicit data containing your new agent parameters
        data = {
            "label": "Test Config",
            "apiKeyName": "Test-Key-01",
            "helperScript": "week1and3",
            "environment": "staging",
            "schedule": "0 0 * * 1",
            "patching_schedule": "04:00 AM Wednesday Weeks 1 & 3",
            "disable_autoremove": True,
            "enable_apt_release_info_change": True,
            "reboot_on_success": True,
            "reboot_after_updates": False, # explicit change from default True
            "max_allowed_uptime": 45
        }

        response = self.client.post(url, data, format='json')

        # Assertions
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('uuid', response.data)
        
        # Verify Database values match payload
        config = AgentInstallConfig.objects.get(uid=response.data['uuid'])
        self.assertEqual(config.label, "Test Config")
        self.assertEqual(config.api_key, api_key)
        self.assertEqual(config.exe_logic, "week1and3")
        self.assertEqual(config.cron, "0 0 * * 1")
        self.assertEqual(config.patching_schedule, "04:00 AM Wednesday Weeks 1 & 3")
        
        # Verify agent flag assertions
        self.assertTrue(config.disable_autoremove)
        self.assertTrue(config.enable_apt_release_info_change)
        self.assertTrue(config.reboot_on_success)
        self.assertFalse(config.reboot_after_updates)
        self.assertEqual(config.max_allowed_uptime, 45)

    def test_create_agent_config_defaults(self):
        """Verify fallback behavior when optional automation flags are omitted from the payload."""
        api_key = APIKey.objects.create(
            name="Test-Key-Defaults", 
            key="test_secret_456", 
            is_active=True
        )

        url = reverse('agent_create_config')
        
        # Minimal payload mimicking missing configuration options
        data = {
            "label": "Minimal Config",
            "apiKeyName": "Test-Key-Defaults",
            "helperScript": "standard",
            "environment": "production",
            "schedule": "0 0 * * *"
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Grab item to assert native Django model default behaviors
        config = AgentInstallConfig.objects.get(uid=response.data['uuid'])
        self.assertFalse(config.disable_autoremove)
        self.assertFalse(config.enable_apt_release_info_change)
        self.assertFalse(config.reboot_on_success)
        self.assertTrue(config.reboot_after_updates)
        self.assertEqual(config.max_allowed_uptime, 20)
        self.assertIsNone(config.patching_schedule)

    def test_create_agent_config_invalid_key(self):
        """Verify error when providing a non-existent or inactive API Key."""
        APIKey.objects.create(name="Disabled-Key", key="secret", is_active=False)
        
        url = reverse('agent_create_config')
        data = {
            "apiKeyName": "Disabled-Key",
            "helperScript": "standard",
            "environment": "production",
            "schedule": "* * * * *"
        }

        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('apiKeyName', response.data)

    def test_create_agent_config_invalid_choice(self):
        """Verify validation fail for invalid exe_logic (helperScript) choice."""
        APIKey.objects.create(name="Valid-Key", key="valid", is_active=True)
        
        url = reverse('agent_create_config')
        data = {
            "apiKeyName": "Valid-Key",
            "helperScript": "invalid_option_here",
            "environment": "production",
            "schedule": "0 0 * * *"
        }

        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)