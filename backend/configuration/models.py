import secrets, uuid
from django.db import models
from django.core.exceptions import ValidationError

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


class SysConfig(models.Model):
    patching_enabled = models.BooleanField(default=True)
    skip_email_validation = models.BooleanField(default=True)
    disable_registration = models.BooleanField(default=False)


class NotificationService(models.Model):
    SERVICE_TYPES = [
        ('discord', 'Discord Webhook'),
        ('smtp', 'SMTP Email'),
        ('slack', 'Slack Webhook'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, help_text="e.g. 'Ops Discord Channel'")
    type = models.CharField(max_length=20, choices=SERVICE_TYPES, default='discord')
    # Store the primary endpoint (leave blank for SMTP)
    url = models.URLField(max_length=500, null=True, blank=True)
    email_all_users = models.BooleanField(default=True)
    main_email_recipients = models.TextField(null=True, blank=True, help_text="Comma-separated emails")
    recipients = models.TextField(null=True, blank=True, help_text="Comma-separated emails")
    
    active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"
    
    class Meta:
        verbose_name_plural = "Notification Services"


class NotificationSettings(models.Model):
    """
    Global toggles for what events trigger notifications.
    Usually only one row exists in this table.
    """
    failed = models.BooleanField(default=True)
    success = models.BooleanField(default=True)
    partial = models.BooleanField(default=True)
    out_of_date = models.BooleanField(default=True)
    on_server_add = models.BooleanField(default=True)
    on_server_modify = models.BooleanField(default=True)
    on_server_delete = models.BooleanField(default=True)
    site_outdated = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = "Notification Settings"


class AgentInstallConfig(models.Model):
    EXE_TYPES = [
        ('standard', 'Standard (Every Execution)'),
        ('week1and3', 'Patching Week 1 & 3'),
        ('week2and4', 'Patching Week 2 & 4'),
        ('week1', 'Patching Week 1'),
        ('week2', 'Patching Week 2'),
        ('week3', 'Patching Week 3'),
        ('week4', 'Patching Week 4'),
    ]
    
    label = models.CharField(max_length=100, help_text="A friendly name for this configuration")
    api_key = models.ForeignKey('APIKey', on_delete=models.CASCADE, related_name='install_configs')
    base_url = models.URLField(max_length=500, null=True, blank=True)
    uid = models.CharField(max_length=12, unique=True, editable=False, db_index=True)
    exe_logic = models.CharField(default='standard', choices=EXE_TYPES, max_length=20)
    environment = models.CharField(max_length=50, default='production')
    disable_autoremove = models.BooleanField(default=False)
    enable_apt_release_info_change = models.BooleanField(default=False)
    reboot_on_success = models.BooleanField(default=False)
    reboot_after_updates = models.BooleanField(default=True)
    max_allowed_uptime = models.IntegerField(default=20)
    cron = models.CharField(max_length=100, default="0 0 * * *")
    patching_schedule = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)


    def save(self, *args, **kwargs):
        if not self.uid:
            self.uid = secrets.token_urlsafe(9)
        super().save(*args, **kwargs)

    class Meta:
        verbose_name_plural = "Agent Install Configs"
        ordering = ['-created_at']


class AstraeaAgentInfo(models.Model):
    version = models.CharField(max_length=20, null=False, blank=False, default="1.0.0")
    updated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "Agent Agent Info"


class ZabbixConfiguration(models.Model):
    enable = models.BooleanField(default=False)
    api_url = models.URLField(help_text="e.g., http://zabbix.example.com/", blank=True, null=True)
    api_token = models.CharField(max_length=255, blank=True, null=True)
    
    def clean(self):
        if not self.pk and ZabbixConfiguration.objects.exists():
            raise ValidationError('Only one ZabbixConfiguration instance is allowed. Update the existing record.')

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

class ZabbixMaintenance(models.Model):
    zabbix_config = models.ForeignKey(ZabbixConfiguration, on_delete=models.CASCADE)
    server_id = models.CharField(max_length=255, db_index=True, null=True, blank=True)
    host_id = models.CharField(max_length=50)
    maintenance_id = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Zabbix Maintenance Tracker"