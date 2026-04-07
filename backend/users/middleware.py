from django.utils import timezone
from datetime import timedelta

class UpdateLastActivityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        if request.user and request.user.is_authenticated and request.user.pk:
            now = timezone.now()
            last_login = request.user.last_login
            
            # Only update if the last update was more than 5 minutes ago, reduces how often the database is hit
            if not last_login or (now - last_login) > timedelta(minutes=5):
                request.user.last_login = now
                request.user.save(update_fields=['last_login'])
        
        return response