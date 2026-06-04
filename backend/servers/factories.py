import factory
from django.utils import timezone
from .models import Server, Package, PackageUpdate, NetworkInterface

class ServerFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Server

    hostname = factory.Sequence(lambda n: f"server-{n}.internal")
    os_version = "Ubuntu 22.04"
    uptime = "10 days"
    patch_schedule = "10am Wednesday Weeks 1 & 3"
    last_reboot = factory.LazyFunction(lambda: timezone.now() - timezone.timedelta(days=14))
    last_patch_date = factory.LazyFunction(lambda: timezone.now() - timezone.timedelta(days=45))
    total_packages_updated = 10
    duration = 60
    env = "Prod"

    @factory.post_generation
    def create_interfaces(self, create, extracted, **kwargs):
        """
        Logic:
        1. If 'extracted' is passed (e.g., ServerFactory(create_interfaces=[...])), use that.
        2. If NO 'extracted' is passed, but we are 'creating' (not just building), 
           generate a default interface so the server isn't 'headless'.
        """
        if not create:
            return

        # Scenario A: You explicitly provided interfaces (e.g. ServerFactory(create_interfaces=[...]))
        if extracted is not None:
            for iface_data in extracted:
                # If extracted is an empty list [], this loop simply won't run.
                # This is perfect for the "IP Stealing" test.
                NetworkInterface.objects.create(server=self, **iface_data)
            return

        # Scenario B: Default Behavior
        # We check a custom 'minimal' argument if you want to be extra safe
        if kwargs.get('minimal', False):
            return

        # Scenario C: Management Command / General Testing
        # Only create a default if we aren't explicitly trying to keep the server empty
        NetworkInterfaceFactory(server=self)

class NetworkInterfaceFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = NetworkInterface

    server = factory.SubFactory("apps.servers.tests.factories.ServerFactory")
    # Start sequence at a higher number to stay away from test-specific IPs
    ip_address = factory.Sequence(lambda n: f"10.0.0.{n + 100}")
    mac_address = factory.Sequence(lambda n: f"00:11:22:33:44:{n % 255:02x}")
    interface_name = "eth0"

class PackageFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Package
    
    name = "nginx"
    version = "1.24.0"