from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core import exceptions

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'last_login', 'is_superuser', 'is_staff', 'date_joined', 'is_active']
        read_only_fields = ['id', 'last_login', 'date_joined']
    
    def validate(self, data):
        request = self.context.get('request')
        if not request:
            return data

        if 'is_superuser' in data and not request.user.is_superuser:
            raise serializers.ValidationError({
                "is_superuser": "Only superusers can modify this field."
            })
        
        return data