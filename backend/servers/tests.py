from django.contrib.auth import get_user_model
from django.urls import reverse
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from .factories import ServerFactory, PackageFactory
from .models import Package, PackageUpdate, Server, APIKey

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
        server = ServerFactory(hostname="prod-web-01", rebooted=False)
        url = reverse('save_patching_data') # Assuming this name in urls.py
        
        payload = {
            "hostname": "prod-web-01",
            "ip_address": "192.168.1.50",
            "mac_address": "AA:BB:CC:DD:EE:FF",
            "os_version": "Debian 12",
            "rebooted": True,
            "uptime": "1 hour",
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
        self.assertTrue(server.rebooted)
        self.assertEqual(Package.objects.count(), 2)
        self.assertEqual(PackageUpdate.objects.filter(server=server).count(), 2)

        # Check Individual Cache updated
        cached_data = cache.get(f"server_data:{server.id}")
        self.assertIsNotNone(cached_data)
        self.assertEqual(cached_data['os_version'], "Debian 12")
        self.assertTrue(cached_data['rebooted'])
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
        from .utils import refresh_dashboard_stats
        refresh_dashboard_stats()

        # We will loop 10 times to simulate 10 different servers reporting in
        for i in range(10):
            vm_name = f"server-{i}"
            payload = {
                "hostname": vm_name,
                "ip_address": f"10.0.0.{i}",
                "mac_address": f"00:11:22:33:44:00",
                "os_version": "Ubuntu 22.04",
                "rebooted": False,
                "uptime": "10 days",
                "total_packages_updated": 1,
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
        
        server_cache_key = f"server_data:{server.id}"
        self.assertIsNotNone(cache.get(server_cache_key)) # Confirm it exists initially

        # 2. Act: Call the delete view
        url = reverse('delete_server')
        response = self.client.post(url, {'hostname': "delete-me-vm"}, format='json')

        # 3. Assertions
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check DB
        self.assertFalse(Server.objects.filter(hostname="delete-me-vm").exists())
        
        # Check Individual Cache
        self.assertIsNone(cache.get(server_cache_key))
        
        # Check Dashboard Stats decreased
        stats = cache.get("dashboard_stats")
        self.assertEqual(stats['total_servers'], 0)


    def test_quick_search_redis_vs_db(self):
        """Verify search works from Redis cache and correctly filters results."""
        # 1. Setup: Create 2 VMs
        s1 = ServerFactory(hostname="alpha-web", ip_address="10.0.0.1")
        s2 = ServerFactory(hostname="beta-db", ip_address="10.0.0.2")
        
        s1.refresh_from_db()
        s2.refresh_from_db()

        # Manually trigger the cache warming so they are in Redis
        from .utils import cache_individual_vms
        cache_individual_vms([s1, s2])

        url = reverse('vm_search')

        # 2. Test Search by Hostname
        resp1 = self.client.get(url, {'q': 'alpha'})
        self.assertEqual(str(s1.server_id), resp1.data['results'][0]['server_id'])
        self.assertEqual(len(resp1.data['results']), 1)
        self.assertEqual(resp1.data['results'][0]['hostname'], "alpha-web")
        self.assertFalse(resp1.data['is_partial']) # Should be False because it came from Redis

        # 3. Test Search by IP
        resp2 = self.client.get(url, {'q': '10.0.0.2'})
        self.assertEqual(str(s2.server_id), resp2.data['results'][0]['server_id'])
        self.assertEqual(len(resp2.data['results']), 1)
        self.assertEqual(resp2.data['results'][0]['hostname'], "beta-db")

    
    def test_quick_search_fallback_to_db(self):
        """Verify search falls back to DB when Redis is empty (is_partial=True)."""
        # 1. Setup: Create a VM (Signal automatically puts it in Redis)
        ServerFactory(hostname="ghost-vm")
        
        # 2. MANUALLY CLEAR CACHE HERE 
        # This wipes out what the signal just did, forcing the view to go to the DB
        cache.clear() 
        
        url = reverse('vm_search')

        # 3. Act: Search for the VM
        response = self.client.get(url, {'q': 'ghost'})

        # 4. Assertions
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "ghost-vm")
        
        # This should now be True!
        self.assertTrue(response.data['is_partial'])


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