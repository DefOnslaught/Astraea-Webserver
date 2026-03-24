import secrets
from django.db import models

class APIKey(models.Model):
    name = models.CharField(max_length=100, help_text="e.g., 'Production Linux Cluster'", db_index=True)
    key = models.CharField(max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    @staticmethod
    def generate_key():
        """Generates a random key. Returns the key."""
        key = secrets.token_urlsafe(32)
        return key

    def __str__(self):
        return self.name