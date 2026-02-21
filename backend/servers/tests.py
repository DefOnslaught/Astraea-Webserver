from django.test import TestCase
from django.urls import reverse
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework import status

from .factories import ServerFactory, PackageFactory
from .models import Package, PackageUpdate

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

    def test_software_search_grouping(self):
        """Verify PackageSearchView returns grouped data and uses cache."""
        # 1. Setup: 2 servers with same package version, 1 with different version
        pkg_v1 = PackageFactory(name="python3", version="3.10")
        pkg_v2 = PackageFactory(name="python3", version="3.11")
        
        s1 = ServerFactory()
        s2 = ServerFactory()
        s3 = ServerFactory()

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