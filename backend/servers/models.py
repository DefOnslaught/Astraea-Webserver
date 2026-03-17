import secrets, hashlib, uuid
from django.db import models

class Server(models.Model):
    server_id = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    hostname = models.CharField(max_length=255, unique=True)
    ip_address = models.GenericIPAddressField()
    mac_address = models.CharField(max_length=17, null=True, blank=True)
    os_version = models.CharField(max_length=100, null=True, blank=True)
    uptime = models.CharField(max_length=100, null=True, blank=True)
    last_reboot = models.DateTimeField(null=True, blank=True)
    last_patch_date = models.DateTimeField(null=True, blank=True)
    patch_schedule = models.CharField(max_length=100, null=True, blank=True)
    enable_patching = models.BooleanField(default=True)
    env = models.CharField(max_length=100, null=True, blank=True)
    total_packages_updated = models.IntegerField(default=0)

    def __str__(self):
        return self.hostname

class Package(models.Model):
    """The unique catalog of every package + version combination ever seen."""
    name = models.CharField(max_length=255)
    version = models.CharField(max_length=100)

    class Meta:
        # This prevents having two 'nginx 1.25' records
        unique_together = ('name', 'version')

    def __str__(self):
        return f"{self.name} v{self.version}"

class PackageUpdate(models.Model):
    """The historical log: Which server got which package and when."""
    server = models.ForeignKey(Server, on_delete=models.CASCADE, related_name='updates')
    package = models.ForeignKey(Package, on_delete=models.CASCADE, related_name='installed_on')
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.server.hostname} -> {self.package}"

class APIKey(models.Model):
    name = models.CharField(max_length=100, help_text="e.g., 'Production Linux Cluster'")
    key_hash = models.CharField(max_length=64, unique=True, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    @staticmethod
    def generate_key():
        """Generates a random key. Returns (plain_text, hashed)."""
        plain_key = secrets.token_urlsafe(32)
        hashed_key = hashlib.sha256(plain_key.encode()).hexdigest()
        return plain_key, hashed_key

    def __str__(self):
        return self.name