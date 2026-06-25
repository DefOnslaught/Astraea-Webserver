from django.urls import path
from .views import (
    CreateAPIKeyView, GetAPIKeys, DeleteAPIKey, 
    UpdateAPIKey, SystemConfig, NotificationSettingsView, 
    NotificationServicesView, AgentCreateConfigView, AgentInstallScriptView,
    AgentFileHandlerView, AgentUploadHandlerView, GetAgentInstallConfigs, 
    DeleteAgentInstallConfig, ZabbixConfig)

urlpatterns = [
    path('api-key/create/', CreateAPIKeyView.as_view(), name='create_api_key'),
    path('api-key/all/', GetAPIKeys.as_view(), name='get_api_keys'),
    path('api-key/update/', UpdateAPIKey.as_view(), name='update_api_key'),
    path('api-key/delete/', DeleteAPIKey.as_view(), name='delete_api_key'),
    path('sysconfig/', SystemConfig.as_view(), name='system_config'),
    path('notify_settings/', NotificationSettingsView.as_view(), name='notify_settings'),
    path('notify_services/', NotificationServicesView.as_view(), name='notify_services'),
    path('agent_create_config/', AgentCreateConfigView.as_view(), name='agent_create_config'),
    path('install_script/<str:uid>/', AgentInstallScriptView.as_view(), name='agent_install_script'),
    path('agent_file/', AgentFileHandlerView.as_view(), name='agent_file_handler'),
    path('upload_agent_file/', AgentUploadHandlerView.as_view(), name='agent_upload_handler'),
    path('agent_install_configs/', GetAgentInstallConfigs.as_view(), name="agent_install_configs"),
    path('delete_agent_install_config/', DeleteAgentInstallConfig.as_view(), name="delete_agent_install_config"),
    path('zabbix_config/', ZabbixConfig.as_view(), name='zabbix_config')
]