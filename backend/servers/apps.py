from django.apps import AppConfig


class ServersConfig(AppConfig):
    name = 'servers'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        import servers.signals
