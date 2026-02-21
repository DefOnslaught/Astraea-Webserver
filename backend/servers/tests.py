from django.test import TestCase
from django.urls import reverse
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone

from .factories import ServerFactory, PackageFactory
from .models import Package, PackageUpdate, Server

class PatchingSystemTests(APITestCase):

    def setUp(self):
        # Clear cache before every test to ensure isolation
        cache.clear()


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
        response = self.client.post(url, payload, format='json')
        
        # 3. Assertions
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check DB updated
        server.refresh_from_db()
        self.assertTrue(server.rebooted)
        self.assertEqual(Package.objects.count(), 2)
        self.assertEqual(PackageUpdate.objects.filter(server=server).count(), 2)

        # Check Individual Cache updated
        cached_data = cache.get(f"server_data:{server.id}")
        self.assertIsNotNone(cached_data)
        self.assertEqual(cached_data['os_version'], "Debian 12")
        self.assertTrue(cached_data['rebooted'])


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
        """Simulates 5 different VMs checking in with patching data."""
        url = reverse('save_patching_data')
        from .utils import refresh_dashboard_stats
        refresh_dashboard_stats()

        # We will loop 5 times to simulate 5 different servers reporting in
        for i in range(5):
            vm_name = f"server-{i}"
            payload = {
                "hostname": vm_name,
                "ip_address": f"10.0.0.{i}",
                "mac_address": f"00:11:22:33:44:0{i}",
                "os_version": "Ubuntu 22.04",
                "rebooted": False,
                "uptime": "10 days",
                "total_packages_updated": 1,
                "packages": [{"package_name": "kernel", "version": "5.15"}]
            }
            response = self.client.post(url, payload, format='json')
            self.assertEqual(response.status_code, status.HTTP_200_OK)

        # ASSERTIONS
        # 1. Check Database has 5 servers
        self.assertEqual(Server.objects.count(), 5)
        
        # 2. Check Redis Dashboard accurately reflects all 5 (they are all fresh)
        stats = cache.get("dashboard_stats")
        self.assertEqual(stats['total_servers'], 5)
        self.assertEqual(stats['outdated_servers'], 0)

        # 3. Check that the Package catalog only has 1 entry (since they all sent 'kernel 5.15')
        # This proves your unique_together and get_or_create logic works!
        self.assertEqual(Package.objects.count(), 1)


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
        
        # Manually trigger the cache warming so they are in Redis
        from .utils import cache_individual_vms
        cache_individual_vms([s1, s2])

        url = reverse('vm_search')

        # 2. Test Search by Hostname
        response = self.client.get(url, {'q': 'alpha'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "alpha-web")
        self.assertFalse(response.data['is_partial']) # Should be False because it came from Redis

        # 3. Test Search by IP
        response = self.client.get(url, {'q': '10.0.0.2'})
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['hostname'], "beta-db")

    
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