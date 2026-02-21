from django.utils import timezone
from django.db import models

class Server(models.Model):
    hostname = models.CharField(max_length=255, unique=True)
    ip_address = models.GenericIPAddressField()
    mac_address = models.CharField(max_length=17)
    os_version = models.CharField(max_length=100)
    uptime = models.CharField(max_length=100)
    rebooted = models.BooleanField(default=False)
    last_patch_date = models.DateTimeField(default=timezone.now)
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