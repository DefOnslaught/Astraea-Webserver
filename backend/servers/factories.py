import factory
from django.utils import timezone
from .models import Server, Package, PackageUpdate

class ServerFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Server

    hostname = factory.Sequence(lambda n: f"server-{n}.internal")
    ip_address = factory.Sequence(lambda n: f"10.0.0.{n}")
    mac_address = "00:00:00:00:00:00"
    os_version = "Ubuntu 22.04"
    uptime = "10 days"
    patch_schedule = "10am Wednesday Weeks 1 and 3"
    last_reboot = factory.LazyFunction(lambda: timezone.now() - timezone.timedelta(days=14))
    # Default to an old date so they start as "outdated"
    last_patch_date = factory.LazyFunction(lambda: timezone.now() - timezone.timedelta(days=45))
    total_packages_updated = 10
    env = "Prod"

class PackageFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Package
    
    name = "nginx"
    version = "1.24.0"