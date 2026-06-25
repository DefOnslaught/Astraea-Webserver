from rest_framework import serializers

from .models import APIKey, SysConfig, NotificationService, NotificationSettings, AgentInstallConfig, ZabbixConfiguration

class APIKeySerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ['name', 'key', 'created_at', 'last_used', 'is_active']
        read_only_fields = ['id']


class SysConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SysConfig
        fields = ['patching_enabled', 'skip_email_validation', 'disable_registration']


class ApiKeyUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = APIKey
        fields = ['id', 'name', 'is_active']
        read_only_fields = ['id']


class NotificationServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationService
        fields = ['id', 'name', 'type', 'url', 'recipients', 'active']


class NotificationSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationSettings
        fields = ['failed', 'success', 'partial', 'out_of_date']


class AgentInstallConfigSerializer(serializers.ModelSerializer):
    # Mapping 'apiKeyName' (React) to 'api_key' (Model) via SlugRelatedField
    apiKeyName = serializers.SlugRelatedField(
        slug_field='name',
        queryset=APIKey.objects.filter(is_active=True),
        source='api_key'
    )
    
    # Mapping 'helperScript' (React) to 'exe_logic' (Model)
    helperScript = serializers.ChoiceField(
        choices=AgentInstallConfig.EXE_TYPES, 
        source='exe_logic'
    )
    
    # Mapping 'schedule' (React) to 'cron' (Model)
    schedule = serializers.CharField(source='cron')
    
    # 'uuid' is for the outgoing response (React expects res.data.uuid)
    uuid = serializers.CharField(source='uid', read_only=True)

    class Meta:
        model = AgentInstallConfig
        fields = ['uuid', 'label', 'apiKeyName', 'helperScript', 'environment',
                  'schedule', 'patching_schedule', 'disable_autoremove', 'enable_apt_release_info_change',
                  'reboot_on_success', 'reboot_after_updates', 'max_allowed_uptime']

    def validate_apiKeyName(self, value):
        """Custom validation to ensure the key is actually active."""
        if not value.is_active:
            raise serializers.ValidationError("This API Key is disabled.")
        return value


class ZabbixConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ZabbixConfiguration
        fields = ['enable', 'api_url', 'api_token']