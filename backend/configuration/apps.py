from django.apps import AppConfig


class ConfigurationConfig(AppConfig):
    name = 'configuration'

    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        import configuration.signals