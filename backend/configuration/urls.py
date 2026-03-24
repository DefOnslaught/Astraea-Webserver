from django.urls import path
from .views import CreateAPIKeyView, GetAPIKeys, DeleteAPIKey, UpdateAPIKey

urlpatterns = [
    path('api-key/create/', CreateAPIKeyView.as_view(), name='create_api_key'),
    path('api-key/all/', GetAPIKeys.as_view(), name='get_api_keys'),
    path('api-key/update/', UpdateAPIKey.as_view(), name='update_api_key'),
    path('api-key/delete/', DeleteAPIKey.as_view(), name='delete_api_key'),
]