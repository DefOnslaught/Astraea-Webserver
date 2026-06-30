import uuid, os
from django.db import models
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.storage import FileSystemStorage
from django.core.validators import MaxLengthValidator

from users.permissions import checkIsStaff

User = get_user_model()
PROTECTED_STORAGE_PATH = os.path.join(settings.BASE_DIR, 'protected_storage')
protected_storage = FileSystemStorage(location=PROTECTED_STORAGE_PATH)

class ReportFilter(models.Model):
    """
    Stores user-defined filters with support for sharing and validation.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_index=True)
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='report_filters', db_index=True)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True, help_text="Brief context for the filter.")
    is_public = models.BooleanField(default=False, help_text="Visible to all authenticated users.", db_index=True)
    is_global = models.BooleanField(default=False, help_text="System-wide defaults (Staff only).", db_index=True)
    criteria = models.JSONField(default=dict, help_text="Key-value pairs for filtering.")
    selected_fields = models.JSONField(default=list, help_text="List of string fields to include in the CSV.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['is_public', 'is_global']),
            models.Index(fields=['user']),
        ]

    def clean(self):
        """
        Custom validation to prevent invalid filter states.
        """
        if self.user:
            if (self.is_public or self.is_global) and not checkIsStaff(self.user):
                raise ValidationError({"is_public": "Only staff members can publish shared filters."})
        
        if self.is_global and not self.is_public:
            self.is_public = True

        if not isinstance(self.criteria, dict):
            raise ValidationError({"criteria": "Criteria must be a dictionary."})
            
        if not self.criteria:
            raise ValidationError({"criteria": "Filter criteria cannot be empty."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        username = self.user.username if self.user else "Deleted User"
        return f"{self.name} (Owner: {username})"

class ReportRequest(models.Model):
    """
    Tracks the status of an asynchronous report generation job.
    """
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, db_index=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, db_index=True)
    file_name = models.CharField(max_length=80, null=True, blank=True, validators=[MaxLengthValidator(80)])
    report_filter = models.ForeignKey(ReportFilter, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    applied_criteria = models.JSONField(default=dict)
    selected_fields = models.JSONField(default=list)
    file_path = models.FileField(upload_to='reports/', storage=protected_storage, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Report {self.id} [{self.status}]"