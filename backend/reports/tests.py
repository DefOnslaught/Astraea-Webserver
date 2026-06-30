import shutil, os
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from unittest.mock import patch

from .models import ReportFilter, ReportRequest

User = get_user_model()

class ReportSystemTests(APITestCase):

    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_superuser(email="admin@test.com", username="admin", password="password123")
        self.user = User.objects.create_user(email="user@test.com",username="regular", password="password123")
        
        self.filter = ReportFilter.objects.create(
            user=self.user,
            name="User Filter",
            criteria={"hostname__icontains": "prod"},
            selected_fields=["hostname"]
        )
        self.client.force_authenticate(user=self.user)

    def tearDown(self):
        """Clean up generated test files after every test."""
        for report in ReportRequest.objects.all():
            if report.file_path:
                if os.path.exists(report.file_path.path):
                    report.file_path.delete(save=False)
        
        ReportRequest.objects.all().delete()
        ReportFilter.objects.all().delete()
        
        super().tearDown()

    # --- Filter Tests ---
    def test_get_filters_includes_shared_and_personal(self):
        ReportFilter.objects.create(
            user=self.admin, 
            name="Global", 
            is_public=True, 
            criteria={"env": "prod"}, 
            selected_fields=["env"]
        )
        
        response = self.client.get(reverse('get_filters'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 2)

    def test_non_staff_cannot_create_public_filter(self):
        data = {
            "criteria": {"os_version": "Ubuntu 22.04"},
            "selected_fields": ["hostname"],
            "save_filter": True,
            "filter_name": "My Public Filter",
            "is_public": True
        }
        # FIX: Added format='json'
        response = self.client.post(reverse('create_query'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("is_public", response.data)
        
    def test_edit_filter_success(self):
        url = reverse('edit_filter', kwargs={'filter_id': self.filter.id})
        data = {"name": "Updated Filter Name"}
        # FIX: Added format='json'
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        self.filter.refresh_from_db()
        self.assertEqual(self.filter.name, "Updated Filter Name")

    def test_delete_own_filter(self):
        url = reverse('delete_filter', kwargs={'filter_id': self.filter.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(ReportFilter.objects.filter(id=self.filter.id).exists())

    def test_cannot_delete_other_users_filter(self):
        other_user = User.objects.create_user(email="other@test.com",username="other", password="password123")
        other_filter = ReportFilter.objects.create(user=other_user, name="Other", criteria={"env": "dev"}, selected_fields=["env"])
        
        url = reverse('delete_filter', kwargs={'filter_id': other_filter.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # --- Report Generation Tests ---
    @patch('reports.views.generate_dynamic_report_task.delay')
    def test_create_report_success_and_task_called(self, mock_task_delay):
        data = {
            "criteria": {"hostname__icontains": "prod"},
            "selected_fields": ["hostname", "os_version"]
        }
        # FIX: Added format='json'
        response = self.client.post(reverse('create_query'), data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn('report_id', response.data)
        
        # Verify the celery task was dispatched
        mock_task_delay.assert_called_once()
        report_id = mock_task_delay.call_args[0][0]
        self.assertEqual(str(response.data['report_id']), report_id)

    def test_create_report_invalid_filename(self):
        data = {
            "criteria": {"hostname__icontains": "prod"},
            "file_name": "../../etc/passwd",
            "selected_fields": ["hostname"]
        }
        # FIX: Added format='json'
        response = self.client.post(reverse('create_query'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_report_invalid_criteria(self):
        data = {
            "criteria": {"malicious_field": "value"},
            "selected_fields": ["hostname"]
        }
        # FIX: Added format='json'
        response = self.client.post(reverse('create_query'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
    def test_create_report_empty_selected_fields(self):
        data = {
            "criteria": {"hostname__icontains": "prod"},
            "selected_fields": []
        }
        response = self.client.post(reverse('create_query'), data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_finished_reports_permissions(self):
        # Create reports for two users
        ReportRequest.objects.create(user=self.user, status='completed')
        other_user = User.objects.create_user(email="spy@test.com", username="spy", password="password123")
        ReportRequest.objects.create(user=other_user, status='completed')
        
        url = reverse('get_finished_reports')
        response = self.client.get(url)
        
        # Regular user should only see their own 1 report
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        
        # Admin should see both
        self.client.force_authenticate(user=self.admin)
        response_admin = self.client.get(url)
        self.assertEqual(len(response_admin.data), 2)

    def test_check_report_status(self):
        report = ReportRequest.objects.create(user=self.user, status='pending')
        url = reverse('check_report', kwargs={'report_id': report.id})
        response = self.client.get(url)
        self.assertEqual(response.data['status'], 'pending')

    def test_download_unauthorized_access(self):
        # Create a report for someone else
        other_user = User.objects.create_user(email="spy@test.com", username="spy", password="password123")
        report = ReportRequest.objects.create(user=other_user, status='completed')
        
        url = reverse('download_report', kwargs={'report_id': report.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        
    def test_download_authorized_access(self):
        # Create a mock file
        dummy_file = SimpleUploadedFile("test_file.csv", b"hostname,os_version\nserver1,Ubuntu")
        report = ReportRequest.objects.create(
            user=self.user, 
            status='completed', 
            file_path=dummy_file,
            file_name="custom_name"
        )
        
        url = reverse('download_report', kwargs={'report_id': report.id})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.get('Content-Disposition'), 'attachment; filename="custom_name.csv"')