from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask, IntervalSchedule, CrontabSchedule

class Command(BaseCommand):
    help = 'Sets up initial periodic tasks if they do not exist'

    def handle(self, *args, **kwargs):
        # 1. Define Intervals
        schedule_30m, _ = IntervalSchedule.objects.get_or_create(every=30, period=IntervalSchedule.MINUTES)
        schedule_1h, _ = IntervalSchedule.objects.get_or_create(every=1, period=IntervalSchedule.HOURS)
        schedule_15m, _ = IntervalSchedule.objects.get_or_create(every=15, period=IntervalSchedule.MINUTES)
        schedule_24h, _ = IntervalSchedule.objects.get_or_create(every=24, period=IntervalSchedule.HOURS)

        # 2. Define Crontabs
        cron_daily_10am, _ = CrontabSchedule.objects.get_or_create(hour=10, minute=0)
        cron_daily_12pm, _ = CrontabSchedule.objects.get_or_create(hour=12, minute=0)

        tasks = [
            ('reconcile-pending-notifications', 'notifications.tasks.reconcile_notifications', schedule_30m),
            ('cleanup-old-notifications', 'notifications.tasks.delete_sent_notifications', schedule_1h),
            ('check-outdated-servers', 'notifications.tasks.notify_out_of_date', None, cron_daily_10am),
            ('delete-expired-password-resets', 'users.tasks.remove_expired_password_resets', None, cron_daily_12pm),
            ('failsafe-zabbix-cleanup', 'configuration.tasks.failsafe_cleanup_orphans', schedule_15m),
            ('check-if-site-outdated', 'configuration.tasks.check_if_site_outdated', schedule_24h),
            ('delete-old-reports', 'reports.tasks.delete_old_reports', schedule_30m),
        ]

        for name, task_path, interval, *cron in tasks:
            cron_obj = cron[0] if cron else None
            
            tasks, created = PeriodicTask.objects.update_or_create(
                name=name,
                defaults={
                    'task': task_path,
                    'interval': interval,
                    'crontab': cron_obj,
                    'enabled': True
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f'Successfully set up task: {name}'))