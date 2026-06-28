export const PUBLIC_PATHS = ["/login", "/register", "/verify", "/forgot-password"];
export const AUTH_PAGES = ["/login", "/register", "/logout"];

export const API_ENDPOINTS = {
    DASHBOARD: "api/servers/dashboard/",

    SESSION_STATUS: "api/users/session-status/",
    SESSION_EXTEND: "api/users/session-extend/",
    REFRESH: "api/users/login/refresh/",
    CSRF: "api/users/csrf/",
    LOGIN: "api/users/login/",
    LOGOUT: "api/users/logout/",
    LOGOUT_ALL_DEVICES: "api/users/logout_all_devices/",
    REGISTER: "api/users/register/",
    VERIFY_LINK: "api/users/verify/",
    RESEND_VERIFICATION: "api/users/verify/resend/",
    PROFILE: "api/users/profile/",
    CHANGE_PASSWORD: "api/users/profile/change-password/",
    FORGOT_PASSWORD_EMAIL: "api/users/reset-password/",
    FORGOT_PASSWORD_RESET: "api/users/reset-password/reset/",

    DASHBOARD_STATS: "api/servers/dashboard/stats/",
    SERVER_SEARCH: "api/servers/search/",
    PACKAGE_SEARCH: "api/servers/software/search/",
    PACKAGE_SERVER_LIST: "api/servers/software/server_list/",

    UPDATE_SERVER: "api/servers/patching/update/",
    DELETE_SERVER: "api/servers/patching/delete/",
    INSPECT_SERVER: "api/servers/inspect/",
    SERVER_HISTORY: "api/servers/inspect/history/",
    SERVER_PACKAGES: "api/servers/inspect/packages/",
    SESSION_DETAILS: "api/servers/inspect/patch_session/",

    API_KEY_CREATE: "api/config/api-key/create/",
    API_KEY_GET_ALL: "api/config/api-key/all/",
    API_KEY_UPDATE: "api/config/api-key/update/",
    API_KEY_DELETE: "api/config/api-key/delete/",
    SYSTEM_CONFIG: "api/config/sysconfig/",
    PURGE_OLD_PACKAGES: "api/config/sysconfig/purge_old_packages/",
    NOTIFY_SETTINGS: "api/config/notify_settings/",
    NOTIFY_SERVICES: "api/config/notify_services/",
    TEST_DISCORD: "api/notifications/test/discord/",
    TEST_EMAIL: "api/notifications/test/email/",
    AGENT_CREATE_CONFIG: "api/config/agent_create_config/",
    AGENT_UPLOAD: "api/config/upload_agent_file/",
    AGENT_INSTALL_CONFIGS: "api/config/agent_install_configs/",
    DELETE_AGENT_INSTALL_CONFIG: "api/config/delete_agent_install_config/",
    ZABBIX_CONFIG: "api/config/zabbix_config/",
    TEST_ZABBIX: "api/config/zabbix_config/test/",

    FETCH_USERS: "api/admin/fetch_users/",
    INSPECT_USER: "api/admin/inspect_user/",
    CREATE_USER: "api/admin/create_user/",

    RESET_CACHE: 'api/admin/refresh_cache/',
    CELERY_STATS: 'api/admin/celery_stats/',
    DB_STATS: 'api/admin/db_stats/',
    SYSTEM_STATS: 'api/admin/system_stats/',
    SYSTEM_LOGS: 'api/admin/system_logs/',
};

export const REFRESH_TOKEN_LIFETIME_WARNING = import.meta.env.VITE_REFRESH_TOKEN_LIFETIME_WARNING;
export const PATCH_THRESHOLD_DAYS = import.meta.env.VITE_PATCH_THRESHOLD_DAYS;