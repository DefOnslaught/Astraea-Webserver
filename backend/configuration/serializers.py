from rest_framework import serializers

from .models import APIKey

class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ['name', 'key', 'created_at', 'last_used', 'is_active']
        read_only_fields = ['id']


class ApiKeyUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ['id', 'name', 'is_active']
        read_only_fields = ['id']