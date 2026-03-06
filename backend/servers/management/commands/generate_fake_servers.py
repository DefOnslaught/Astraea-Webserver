from django.core.management.base import BaseCommand
from django.db import transaction
from servers.models import Package, PackageUpdate
from servers.factories import ServerFactory
import random

class Command(BaseCommand):
    help = 'Generates specified amount of servers in the database, default is 25'

    def add_arguments(self, parser):
        # Allow passing the number of servers: python manage.py generate_fake_servers 50
        parser.add_argument(
            'total', 
            type=int, 
            nargs='?', 
            default=25, 
            help='The number of servers to create'
        )

    def handle(self, *args, **kwargs):
        num_servers = kwargs['total']
        
        self.stdout.write(f"Generating {num_servers} servers...")

        # Common package names for variety
        common_packages = ['nginx', 'docker-ce', 'openssl', 'python3', 'kernel-core', 'redis-server']

        with transaction.atomic():
            for i in range(num_servers):
                # Create the server using the factory
                server = ServerFactory()

                # Let's add 3-5 random package updates per server to populate relationships
                num_pkgs = random.randint(3, 5)
                for _ in range(num_pkgs):
                    pkg_name = random.choice(common_packages)
                    pkg_version = f"{random.randint(1, 5)}.{random.randint(0, 20)}.{random.randint(0, 10)}"
                    
                    # get_or_create prevents unique constraint crashes in Package model
                    package, _ = Package.objects.get_or_create(
                        name=pkg_name, 
                        version=pkg_version
                    )
                    
                    PackageUpdate.objects.create(
                        server=server,
                        package=package
                    )

                if (i + 1) % 10 == 0:
                    self.stdout.write(f"Created {i + 1} servers...")

        self.stdout.write(self.style.SUCCESS(f"Successfully created {num_servers} servers and related package logs."))