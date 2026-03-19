from django.core.management.base import BaseCommand
from django.db import transaction
from servers.models import Package, PackageUpdate
from servers.factories import ServerFactory
from servers.utils import cache_individual_vms
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
        
        # 1. Define common software names
        software_names = [
            'nginx', 'docker-ce', 'openssl', 'python3', 'kernel-core', 
            'redis-server', 'postgresql-14', 'systemd', 'vim', 'bash'
        ]

        self.stdout.write("Creating a shared package pool...")

        package_pool = []
        with transaction.atomic():
            for name in software_names:
                # For each software, create 2-3 specific versions that exist in our "world"
                for _ in range(random.randint(2, 3)):
                    version = f"{random.randint(1, 2)}.{random.randint(0, 5)}.{random.randint(0, 10)}"
                    pkg, _ = Package.objects.get_or_create(name=name, version=version)
                    package_pool.append(pkg)

            self.stdout.write(f"Generated {len(package_pool)} unique package-version pairs.")

            # 2. Create Servers and assign packages from the pool
            for i in range(num_servers):
                server = ServerFactory()

                # Each server has a random subset of the "available" packages in the network
                # We use k=random to simulate that some servers are "heavier" than others
                num_installed = random.randint(4, 8)
                assigned_packages = random.sample(package_pool, k=min(num_installed, len(package_pool)))

                for package in assigned_packages:
                    PackageUpdate.objects.create(
                        server=server,
                        package=package
                    )

                # Update the cache for each generated server so the UI reflects them immediately
                cache_individual_vms([server])

                if (i + 1) % 10 == 0:
                    self.stdout.write(f"Created {i + 1} servers...")

        self.stdout.write(self.style.SUCCESS(f"Finished! {num_servers} servers are now sharing {len(package_pool)} packages."))