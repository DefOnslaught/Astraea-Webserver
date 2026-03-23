export const PUBLIC_PATHS = ["/login", "/register"];
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
    PROFILE: "api/users/profile/",
    CHANGE_PASSWORD: "api/users/profile/change-password/",

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

    PATCHING_API_KEY_CREATE: "api/servers/patching/api-key/create/",
};

export const REFRESH_TOKEN_LIFETIME_WARNING = import.meta.env.VITE_REFRESH_TOKEN_LIFETIME_WARNING;
export const PATCH_THRESHOLD_DAYS = import.meta.env.VITE_PATCH_THRESHOLD_DAYS;