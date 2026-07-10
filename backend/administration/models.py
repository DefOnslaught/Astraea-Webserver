from django.db import models

class UpdateCheck(models.Model):
    last_checked_at = models.DateTimeField(null=True, blank=True)
    latest_version_on_github = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        verbose_name = "Update Check"


class AgentUpdateCheck(models.Model):
    last_checked_at = models.DateTimeField(null=True, blank=True)
    latest_version_on_github = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        verbose_name = "Agent Update Check"