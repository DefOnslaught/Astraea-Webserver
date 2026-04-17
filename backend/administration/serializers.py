from rest_framework import serializers
from django.contrib.auth import get_user_model

from users.utils import updateCacheVerificationStatus
from users.models import Verification

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    is_verified = serializers.BooleanField(source='verification.is_verified', read_only=False)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'last_login', 'is_superuser', 'is_staff', 'date_joined', 'is_active', 'is_verified']
        read_only_fields = ['id', 'last_login', 'date_joined']
    
    def update(self, instance, validated_data):
        verification_data = validated_data.pop('verification', None)
        
        instance = super().update(instance, validated_data)

        if verification_data is not None:
            new_status = verification_data.get('is_verified')
            verification, _ = Verification.objects.get_or_create(user=instance)
            
            verification.is_verified = new_status
            verification.save()
            
            updateCacheVerificationStatus(instance.id, new_status)
            instance.verification = verification

        return instance

    def validate(self, data):
        request = self.context.get('request')
        if not request:
            return data

        if 'is_superuser' in data and not request.user.is_superuser:
            raise serializers.ValidationError({
                "is_superuser": "Only superusers can modify this field."
            })
        
        return data