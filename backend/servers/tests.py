import os, uuid
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.core.cache import cache
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
from rest_framework.test import APITestCase
from rest_framework import status

from .factories import ServerFactory, PackageFactory
from .models import Package, PackageUpdate, Server, APIKey
from .utils import cache_individual_vms

User = get_user_model()

class PatchingSystemTests(APITestCase):

    def setUp(self):
        # 1. Clear cache for isolation
        cache.clear()

        # 2. Setup standard user for authenticated views
        self.user = User.objects.create_user(
            email="test@example.com", 
            username="testuser", 
            password="password123"
        )
        self.client.force_authenticate(user=self.user)

        # 3. Setup API Key for the patching views
        # We generate the tuple: (plain_text_key, hashed_version)
        plain_key, hashed_key = APIKey.generate_key()
        
        # Save the HASH to the database
        self.api_key_obj = APIKey.objects.create(
            name="Test Key", 
            key_hash=hashed_key
        )
        
        # Save the PLAIN TEXT to the headers for use in tests
        self.headers = {'HTTP_X_API_KEY': plain_key}

    def test_unauthenticated_access_denied(self):
        """Verify that a user without a token gets a 403."""
        # Manually unauthenticate for just this one test
        self.client.force_authenticate(user=None)
        
        url = reverse('dashboard_stats')
        response = self.client.get(url)
        
        # 403 Forbidden or 401 Unauthorized depending on your settings
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patching_api_updates_db_and_cache(self):
        """Verify the SavePatchingData view correctly updates everything."""
        # 1. Setup existing server
        past_reboot = timezone.now() - timedelta(days=10)
        server = ServerFactory(
            hostname="prod-web-01", 
            last_reboot=past_reboot,
            patch_schedule="Default"
        )
        url = reverse('save_patching_data')
        
        new_reboot_time = timezone.now()

        payload = {
            "server_id": str(server.server_id),
            "hostname": "prod-web-01",
            "ip_address": "192.168.1.50",
            "mac_address": "AA:BB:CC:DD:EE:FF",
            "os_version": "Debian 12",
            "last_reboot": new_reboot_time.isoformat(),
            "patch_schedule": "10AM Wednesday Weeks 1 & 3",
            "uptime": "1 hour",
            "env": "Prod",
            "total_packages_updated": 2,
            "packages": [
                {"package_name": "openssl", "version": "3.0.8"},
                {"package_name": "bash", "version": "5.2.15"}
            ]
        }

        # 2. Fire the request
        response = self.client.post(url, payload, format='json', **self.headers)
        
        # 3. Assertions
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check DB updated
        server.refresh_from_db()
        self.assertIsNotNone(server.server_id)
        self.assertEqual(server.patch_schedule, "10AM Wednesday Weeks 1 & 3")
        self.assertGreater(server.last_reboot, past_reboot)
        self.assertEqual(server.env, "Prod")
        self.assertEqual(Package.objects.count(), 2)
        self.assertEqual(PackageUpdate.objects.filter(server=server).count(), 2)

        # Check Individual Cache updated
        cached_data = cache.get(f"server_data:{server.server_id}")
        self.assertIsNotNone(cached_data)
        self.assertEqual(cached_data['os_version'], "Debian 12")
        self.assertEqual(cached_data['patch_schedule'], "10AM Wednesday Weeks 1 & 3")
        self.assertEqual(cached_data['env'], "Prod")
        from django.utils.dateparse import parse_datetime
        cached_time = parse_datetime(cached_data['last_reboot'])
        self.assertAlmostEqual(cached_time, new_reboot_time, delta=timedelta(seconds=1))
        self.assertEqual(str(server.server_id), str(cached_data['server_id']))

    def test_dashboard_stats_signals(self):
        """Test that adding/deleting servers updates the dashboard counts in Redis."""
        # Start by warming cache with 0 servers
        from .utils import refresh_dashboard_stats
        refresh_dashboard_stats()

        # 1. Create an outdated server (Factory default is 45 days ago)
        ServerFactory()
        stats = cache.get("dashboard_stats")
        self.assertEqual(stats['total_servers'], 1)
        self.assertEqual(stats['outdated_servers'], 1)

        # 2. Create a fresh server (patched today)
        from django.utils import timezone
        ServerFactory(last_patch_date=timezone.now())
        stats = cache.get("dashboard_stats")
        self.assertEqual(stats['total_servers'], 2)
        self.assertEqual(stats['outdated_servers'], 1) # Only the first one is outdated

    def test_bulk_patching_simulation(self):
        """Simulates 10 different VMs checking in with patching data."""
        url = reverse('save_patching_data')
        cache.clear()
        from .utils import refresh_dashboard_stats
        refresh_dashboard_stats()

        reboot_time = timezone.now().replace(microsecond=0).isoformat()

        # We will loop 10 times to simulate 10 different servers reporting in
        for i in range(10):
            vm_name = f"server-{i}"
            payload = {
                "server_id": str(uuid.uuid4()),
                "hostname": vm_name,
                "ip_address": f"10.0.0.{i}",
                "mac_address": f"00:11:22:33:44:00",
                "os_version": "Ubuntu 22.04",
                "last_reboot": reboot_time,
                "uptime": "10 days",
                "env": "Prod",
                "total_packages_updated": 1,
                "patch_schedule": "10AM Wednesday Weeks 1 and 3",
                "packages": [
                    {"package_name": "openssl", "version": "3.0.8"},
                    {"package_name": "bash", "version": "5.2.15"},
                    {"package_name": "darren", "version": "12.14.94"}
                ]
            }
            response = self.client.post(url, payload, format='json', **self.headers)
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        # ASSERTIONS
        # 1. Check Database has 10 servers
        self.assertEqual(Server.objects.count(), 10)
        
        # 2. Check Redis Dashboard accurately reflects all 10
        stats = cache.get("dashboard_stats")
        self.assertEqual(stats['total_servers'], 10)
        self.assertEqual(stats['outdated_servers'], 0)

        # 3. Check that the Package catalog only has 3 entries
        # This proves your unique_together and get_or_create logic works!
        self.assertEqual(Package.objects.count(), 3)

    def test_software_search_grouping(self):
        """Verify PackageSearchView returns grouped data and uses cache."""
        # 1. Setup: 2 servers with same package version, 1 with different version
        pkg_v1 = PackageFactory(name="python3", version="3.10")
        pkg_v2 = PackageFactory(name="python3", version="3.11")
        
        s1, s2, s3 = ServerFactory.create_batch(3)

        PackageUpdate.objects.create(server=s1, package=pkg_v1)
        PackageUpdate.objects.create(server=s2, package=pkg_v1)
        PackageUpdate.objects.create(server=s3, package=pkg_v2)

        url = reverse('package_search')
        response = self.client.get(url, {'q': 'python'})

        # 2. Assertions
        data = response.data
        self.assertEqual(len(data), 1) # One group named 'python3'
        self.assertEqual(data[0]['name'], 'python3')
        
        # Should have two versions inside the group
        versions = data[0]['versions']
        self.assertEqual(len(versions), 2)
        
        # Check cache was set
        self.assertIsNotNone(cache.get("software_search:python"))
 
    def test_delete_server_updates_db_and_cache(self):
        """Verify that deleting a server via the API cleans up Redis and DB."""
        # 1. Setup: Create a server and ensure it's in the cache
        server = ServerFactory(hostname="delete-me-vm")
        from .utils import refresh_dashboard_stats
        refresh_dashboard_stats() # Initialize dashboard counts
        
        server_cache_key = f"server_data:{server.server_id}"
        self.assertIsNotNone(cache.get(server_cache_key)) # Confirm it exists initially

        # 2. Act: Call the delete view
        url = f"{reverse('delete_server')}?server_id={server.server_id}"
        response = self.client.delete(url)

        # 3. Assertions
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check DB
        self.assertFalse(Server.objects.filter(hostname="delete-me-vm").exists())
        
        # Check Individual Cache
        self.assertIsNone(cache.get(server_cache_key))
        
        # Check Dashboard Stats decreased
        stats = cache.get("dashboard_stats")
        self.assertEqual(stats['total_servers'], 0)

    def test_inspect_server_db_and_cache(self):
        """Verify that inspecting a server via the frontend properly uses Redis and DB."""
        server = ServerFactory(hostname="woah-this-vm")
        
        server_cache_key = f"server_data:{server.server_id}"
        self.assertIsNotNone(cache.get(server_cache_key))
        
        url = reverse('inspect_server')
        payload = {
            'server_id': str(server.server_id)
        }
        response = self.client.get(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        server.refresh_from_db()
        self.assertEqual(server.hostname, "woah-this-vm")
        
        cached_data = cache.get(server_cache_key)
        self.assertIsNotNone(cached_data)
        self.assertEqual(cached_data['hostname'], "woah-this-vm")

    def test_server_update_db_and_cache(self):
        """Verify that updating a server via the frontend updates Redis and DB."""
        server = ServerFactory(hostname="update-me-vm", enable_patching=True)
        
        server_cache_key = f"server_data:{server.server_id}"
        self.assertIsNotNone(cache.get(server_cache_key))

        url = reverse('update_server')
        payload = {
            'server_id': str(server.server_id), 
            'enable_patching': False
        }
        response = self.client.post(url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # 1. Verify Database Update
        server.refresh_from_db()
        self.assertEqual(server.enable_patching, False)

        # 2. Verify Cache Update
        cached_data = cache.get(server_cache_key)
        self.assertIsNotNone(cached_data)
        self.assertEqual(cached_data['enable_patching'], False)

    def test_create_api_key_success(self):
        """Verify authenticated users can generate an API key and it's hashed in DB."""
        url = reverse('create_api_key')  # Ensure this matches your urls.py name
        data = {"name": "Production-Cluster-01"}

        # 1. Act: Create the key
        response = self.client.post(url, data, format='json')

        # 2. Assertions for Response
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('plain_key', response.data)
        self.assertEqual(response.data['name'], "Production-Cluster-01")

        # 3. Assertions for Database
        # Verify the plain key IS NOT in the database
        plain_key = response.data['plain_key']
        self.assertFalse(APIKey.objects.filter(key_hash=plain_key).exists())

        # Verify the hash of the plain key IS in the database
        import hashlib
        expected_hash = hashlib.sha256(plain_key.encode()).hexdigest()
        self.assertTrue(APIKey.objects.filter(key_hash=expected_hash).exists())

    def test_api_key_signal_clears_cache(self):
        """Verify that creating an APIKey clears the Redis key_hash cache."""
        # 1. Manually set the cache
        cache.set('valid_api_key_hashes', ['old-hash-1', 'old-hash-2'])

        # 2. Trigger the signal by creating a new key
        _, hashed = APIKey.generate_key()
        APIKey.objects.create(name="Signal Test", key_hash=hashed)

        # 3. Assert the cache was deleted by the signal
        self.assertIsNone(cache.get('valid_api_key_hashes'))

    def test_create_api_key_unauthenticated_denied(self):
        """Verify unauthenticated users cannot create API keys."""
        self.client.force_authenticate(user=None)
        url = reverse('create_api_key')
        
        response = self.client.post(url, {"name": "Hacker-Key"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    @patch('servers.views.warm_cache_in_background')
    def test_dashboard_cold_cache_triggers_warming(self, mock_warm):
        """If cache is empty, view should return 202 and trigger warming task."""
        url = reverse('dashboard_stats')
        response = self.client.get(url)
        
        # 1. Check the response logic
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertEqual(response.data['status'], 'warming')
        
        # 2. Verify the background function was actually called
        mock_warm.assert_called_once()

    def test_dashboard_warm_cache_returns_data(self):
        """If cache exists, return it directly."""
        mock_stats = {
            "total_servers": 10,
            "outdated_servers": 2,
            "total_servers_not_enabled": 2,
            "at_risk": [],
            "recent_activity": [],
            "last_updated": "2026-03-02 12:00:00"
        }
        cache.set("dashboard_stats", mock_stats)
        
        url = reverse('dashboard_stats')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_servers'], 10)

    def test_signals_update_cache_incrementally(self):
        """Tests that post_save signals update the 'dashboard_stats' counts."""
        # 1. Manually prime the cache
        initial_stats = {
            "total_servers": 1,
            "outdated_servers": 0,
            "last_updated": "never"
        }
        cache.set("dashboard_stats", initial_stats)

        # 2. Create a new server that is 'outdated' (last_patch_date is old)
        old_date = timezone.now() - timedelta(days=45)
        Server.objects.create(
            hostname="outdated-srv", 
            ip_address="1.1.1.1", 
            last_patch_date=old_date
        )

        # 3. Check if cache was updated by the signal
        updated_stats = cache.get("dashboard_stats")
        self.assertEqual(updated_stats["total_servers"], 2)
        self.assertEqual(updated_stats["outdated_servers"], 1)

    def test_at_risk_logic_ordering(self):
        """Ensure the 5 oldest servers are returned in the correct order."""
        now = timezone.now()
        # Create 6 servers, all older than 30 days to ensure they qualify
        for i in range(6):
            Server.objects.create(
                hostname=f"srv-{i}",
                ip_address=f"10.0.0.{i}",
                # Start at 40 days ago and go further back
                last_patch_date=now - timedelta(days=40 + (i * 10)) 
            )
        
        from .utils import refresh_dashboard_stats
        stats = refresh_dashboard_stats()
        
        # Now this will pass because all 6 are 'outdated', so it picks the 5 oldest
        self.assertEqual(len(stats['at_risk']), 5)
        self.assertEqual(stats['at_risk'][0]['hostname'], "srv-5")

    def test_delete_signal_updates_counts(self):
        """Ensure deleting a server decrements the total count in cache."""
        # Setup initial cache
        cache.set("dashboard_stats", {
            "total_servers": 1, 
            "outdated_servers": 0,
            "at_risk": [],
            "recent_activity": []
        })
        srv = Server.objects.create(hostname="delete-me", ip_address="1.2.3.4")
        
        # Total should now be 2 (from initial 1 + srv)
        srv.delete()
        
        stats = cache.get("dashboard_stats")
        self.assertEqual(stats["total_servers"], 1)

    def test_healthy_servers_excluded_from_at_risk(self):
        """Confirm that servers patched within the threshold do not appear in At Risk."""
        now = timezone.now()
        threshold_days = int(os.getenv("PATCH_THRESHOLD_DAYS", 30))
        
        for i in range(3):
            Server.objects.create(
                hostname=f"outdated-{i}",
                ip_address=f"10.0.1.{i}",
                last_patch_date=now - timedelta(days=threshold_days + 10 + (i * 10))
            )

        for i in range(3):
            Server.objects.create(
                hostname=f"healthy-{i}",
                ip_address=f"10.0.2.{i}",
                last_patch_date=now - timedelta(days=5 + (i * 5))
            )

        # Force refresh
        from .utils import refresh_dashboard_stats
        stats = refresh_dashboard_stats()

        self.assertEqual(len(stats['at_risk']), 3)

        hostnames = [server['hostname'] for server in stats['at_risk']]
        for name in hostnames:
            self.assertNotIn("healthy", name)

        self.assertEqual(stats['outdated_servers'], 3)


class EnhancedSearchTests(APITestCase):

    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(username="admin", password="password", email="test@example.com")
        self.client.force_authenticate(user=self.user)
        self.url = reverse('vm_search')

        # Create a diverse set of test servers
        self.s1 = Server.objects.create(
            hostname="prod-web-01",
            ip_address="10.0.0.10",
            os_version="Ubuntu 22.04",
            last_patch_date=timezone.now() - timedelta(days=45), # Old
            last_reboot=timezone.now() - timedelta(days=2),
            mac_address="00:1A:2B:3C:4D:5E",
            patch_schedule="1AM Friday Weeks 2 and 4",
            env = "Prod"
        )
        self.s2 = Server.objects.create(
            hostname="prod-db-01",
            ip_address="10.0.0.20",
            os_version="Ubuntu 20.04",
            last_patch_date=timezone.now() - timedelta(days=5), # Recent
            last_reboot=timezone.now() - timedelta(days=30),
            mac_address="00:1A:2B:3C:4D:6F",
            patch_schedule="9PM Thursday Weeks 1 and 3",
            env = "Prod"
        )
        self.s3 = Server.objects.create(
            hostname="dev-app-01",
            ip_address="192.168.1.50",
            os_version="CentOS 7",
            mac_address="00:00:00:00:00:00",
            last_patch_date=None, # Never patched
            last_reboot=timezone.now() - timedelta(days=10),
            patch_schedule="", # Test null
            env = "",
            enable_patching=False
        )

        # Warm the cache manually for "Live" testing
        cache_individual_vms([self.s1, self.s2, self.s3])

    def test_advanced_search_os_specific(self):
        """Verify keyed filter 'os:' works correctly."""
        response = self.client.get(self.url, {'q': 'os:ubuntu'})
        self.assertEqual(len(response.data['results']), 2)
        
        response = self.client.get(self.url, {'q': 'os:centos'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "dev-app-01")

    def test_advanced_search_date_operators(self):
        """Verify 'patched:' with > and < operators."""
        # Search for servers patched more than 30 days ago
        response = self.client.get(self.url, {'q': 'patched:>30d'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "prod-web-01")

        # Search for servers patched within the last 7 days
        response = self.client.get(self.url, {'q': 'patched:<7d'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "prod-db-01")

    def test_search_for_never_patched(self):
        """Verify 'patched:none' logic."""
        response = self.client.get(self.url, {'q': 'patched:none'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "dev-app-01")

    def test_combined_filters_and_terms(self):
        """Verify combining keyed filters and general terms (AND logic)."""
        # Search for Ubuntu servers that specifically have 'db' in their text
        response = self.client.get(self.url, {'q': 'os:ubuntu db'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "prod-db-01")

    def test_quoted_string_search(self):
        """Verify that quoted strings with spaces are handled."""
        response = self.client.get(self.url, {'q': 'os:"Ubuntu 22.04"'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "prod-web-01")

    def test_status_rebooted_filter(self):
        """Verify filtering by reboot status using the new last_reboot field."""
        response = self.client.get(self.url, {'q': 'host:prod-web-01'})
        self.assertEqual(len(response.data['results']), 1)
        
        server_data = response.data['results'][0]
        self.assertIsNotNone(server_data['last_reboot'])
        
        self.assertIsInstance(server_data['last_reboot'], str)
    
    def test_search_pagination(self):
        """Verify that search results are paginated."""
        # Create 25 servers (more than the default page_size of 20)
        for i in range(25):
            Server.objects.create(hostname=f"batch-{i}", ip_address=f"10.1.{i}.1")
        
        # Refresh cache to include new servers
        vms = list(Server.objects.all().values('id', 'server_id', 'hostname', 'ip_address', 'env'))
        cache_individual_vms(vms)

        url = reverse('vm_search')
        response = self.client.get(url, {'q': 'batch'})

        # Check metadata
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 25)
        self.assertEqual(len(response.data['results']), 20) # Default page size
        self.assertIsNotNone(response.data['next']) # Should have a link to page
    
    def test_basic_search_naked_string(self):
        """Verify that searching without keys (hostname/IP) still works."""
        # Search by hostname fragment
        response = self.client.get(self.url, {'q': 'prod-web'})
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['hostname'], "prod-web-01")

        # Search by IP fragment
        response = self.client.get(self.url, {'q': '192.168'})
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['hostname'], "dev-app-01")

    def test_multi_term_general_search(self):
        """Verify that multiple naked terms act as an 'AND' filter."""
        # This should match s1 because it has both 'prod' and 'web'
        response = self.client.get(self.url, {'q': 'prod web'})
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['hostname'], "prod-web-01")

        # This should match nothing (nothing has 'prod' AND 'centos')
        response = self.client.get(self.url, {'q': 'prod centos'})
        self.assertEqual(response.data['count'], 0)
    
    def test_patch_schedule_filter(self):
        """Verify 'schedule:' filter and general search for patch windows."""
        
        # 1. Test targeted search using the key
        response = self.client.get(self.url, {'q': 'schedule:"1AM Friday"' })
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "prod-web-01")

        # 2. Test general term search (no key)
        response = self.client.get(self.url, {'q': 'Thursday'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "prod-db-01")

        # 3. Test empty/null schedule handling
        response = self.client.get(self.url, {'q': 'host:dev-app-01'})
        self.assertEqual(response.data['results'][0]['patch_schedule'], "")
    
    def test_env_filter(self):
        """Verify 'env:' filter and general search for environments."""

        response = self.client.get(self.url, {'q': 'env:Prod'})
        self.assertEqual(len(response.data['results']), 2)
        self.assertEqual(response.data['results'][0]['hostname'], 'prod-db-01')

        response = self.client.get(self.url, {'q': 'Prod'})
        self.assertEqual(len(response.data['results']), 2)
        self.assertEqual(response.data['results'][0]['hostname'], 'prod-db-01')

        response = self.client.get(self.url, {'q': 'host:dev-app-01'})
        self.assertEqual(response.data['results'][0]['env'], "")
    
    def test_enable_patch_filter(self):
        """Verify 'enabled:' filter and general search for status of patching."""

        response = self.client.get(self.url, {'q': 'enabled:false'})
        self.assertEqual(response.data['results'][0]['enable_patching'], False)