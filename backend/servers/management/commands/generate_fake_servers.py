from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from servers.models import Package, PackageUpdate, PatchSession
from servers.factories import ServerFactory
from servers.utils import cache_individual_vms
import random

class Command(BaseCommand):
    help = 'Generates specified amount of servers and patching history'

    def add_arguments(self, parser):
        parser.add_argument('total', type=int, nargs='?', default=25)

    def handle(self, *args, **kwargs):
        num_servers = kwargs['total']
        software_names = ['nginx', 'docker-ce', 'openssl', 'python3', 'kernel-core', 'redis-server']
        
        # Real-world error strings to make the UI look authentic
        error_messages = [
            "DPKG_LOCKED: Could not get lock /var/lib/dpkg/lock-frontend.",
            "CONNECTION_TIMEOUT: Target host unreachable during 'apt-get update'.",
            "DEPENDENCY_RESOLUTION_FAILED: package 'docker-ce' requires 'containerd.io' (>= 1.6.4).",
            "DISK_FULL: No space left on device while unpacking 'kernel-core'.",
            "GPG_ERROR: The following signatures were invalid: EXPKEYSIG 8BAF34"
        ]

        self.stdout.write("Generating shared package pool...")
        
        package_pool = []
        with transaction.atomic():
            for name in software_names:
                for _ in range(random.randint(2, 3)):
                    version = f"{random.randint(1, 2)}.{random.randint(0, 5)}.{random.randint(0, 10)}"
                    pkg, _ = Package.objects.get_or_create(name=name, version=version)
                    package_pool.append(pkg)

            self.stdout.write(f"Creating {num_servers} servers with history...")

            all_new_servers = []
            for i in range(num_servers):
                server = ServerFactory()
                all_new_servers.append(server)

                # Start with a base set of packages for this server
                num_initial = random.randint(4, 6)
                current_inventory = random.sample(package_pool, k=num_initial)

                # Simulate 1-3 sessions over time
                for session_num in range(random.randint(1, 3)):
                    status = 'failed' if random.random() < 0.2 else 'success'
                    
                    # SIMULATION: On each new session, 1 or 2 packages might "update" 
                    # to a different version from the pool, but the rest stay the same.
                    if session_num > 0:
                        # Swap out 1 package for a different version in the pool to simulate an update
                        idx_to_update = random.randint(0, len(current_inventory) - 1)
                        new_pkg = random.choice(package_pool)
                        current_inventory[idx_to_update] = new_pkg

                    session = PatchSession.objects.create(
                        server=server,
                        status=status,
                        error_log=random.choice(error_messages) if status == 'failed' else None,
                        total_updated=len(current_inventory) if status == 'success' else 0,
                        timestamp=timezone.now() - timezone.timedelta(days=(5 - session_num)) # Ensure chronological order
                    )

                    # In a "Full Inventory" model, we save EVERYTHING currently on the box
                    for package in current_inventory:
                        PackageUpdate.objects.create(
                            session=session,
                            package=package,
                            new_version=package.version
                        )

                if (i + 1) % 10 == 0:
                    self.stdout.write(f"Created {i + 1} servers...")

            self.stdout.write("Warming Redis cache...")
            cache_individual_vms(all_new_servers)

        self.stdout.write(self.style.SUCCESS(f"Successfully generated {num_servers} servers with session history."))