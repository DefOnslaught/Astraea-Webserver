import uuid
from django.db import models

class Server(models.Model):
    server_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True)
    hostname = models.CharField(max_length=255, unique=True, db_index=True)
    os_version = models.CharField(max_length=100, null=True, blank=True)
    uptime = models.CharField(max_length=100, null=True, blank=True)
    last_reboot = models.DateTimeField(null=True, blank=True)
    last_patch_date = models.DateTimeField(null=True, blank=True, db_index=True)
    was_rebooted = models.BooleanField(default=False)
    patch_schedule = models.CharField(max_length=100, null=True, blank=True)
    enable_patching = models.BooleanField(default=True, db_index=True)
    env = models.CharField(max_length=100, null=True, blank=True)
    disable_autoremove = models.BooleanField(default=False)
    enable_apt_release_info_change = models.BooleanField(default=False)
    reboot_on_success = models.BooleanField(default=False)
    reboot_after_updates = models.BooleanField(default=True)
    max_allowed_uptime = models.IntegerField(default=20)
    total_packages_updated = models.IntegerField(default=0, db_index=True)
    duration = models.IntegerField(default=0)
    date_registered = models.DateTimeField(auto_now_add=True, blank=True, null=True)
    enable_notifications = models.BooleanField(default=True, db_index=True)
    enable_zabbix = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return self.hostname

class NetworkInterface(models.Model):
    server = models.ForeignKey(Server, on_delete=models.CASCADE, related_name='interfaces')
    ip_address = models.GenericIPAddressField(unique=True, db_index=True)
    mac_address = models.CharField(max_length=17, db_index=True, null=True, blank=True)
    interface_name = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        verbose_name = "Network Interface"

class Package(models.Model):
    """The unique catalog of every package + version combination ever seen."""
    name = models.CharField(max_length=255)
    version = models.CharField(max_length=100)

    class Meta:
        # This prevents having two 'nginx 1.25' records
        unique_together = ('name', 'version')

    def __str__(self):
        return f"{self.name} v{self.version}"

class PatchSession(models.Model):
    """Groups a single run of the patching script."""
    STATUS_CHOICES = [
        ('success', 'Success'),
        ('partial', 'Partial Failure'),
        ('failed', 'Failed'),
    ]
    server = models.ForeignKey(Server, on_delete=models.CASCADE, related_name='patch_sessions')
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='success')
    was_rebooted = models.BooleanField(default=False)
    error_log = models.TextField(null=True, blank=True)
    total_updated = models.IntegerField(default=0)
    duration = models.IntegerField(default=0)
    uptime = models.CharField(max_length=100, null=True, blank=True)

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['server', '-timestamp']),
        ]
    
    def __str__(self):
        return self.server.hostname

class PackageUpdate(models.Model):
    """Historical log of a specific package within a session."""
    session = models.ForeignKey(PatchSession, on_delete=models.CASCADE, related_name='package_details')
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name='usage_history')
    old_version = models.CharField(max_length=100, null=True, blank=True)
    new_version = models.CharField(max_length=100)