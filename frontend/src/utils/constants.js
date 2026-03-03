export const PUBLIC_PATHS = ["/login", "/register"];
export const AUTH_PAGES = ["/login", "/register", "/logout"]

export const API_ENDPOINTS = {
    DASHBOARD: "api/servers/dashboard/",

    SESSION_STATUS: "api/users/session-status/",
    SESSION_EXTEND: "api/users/session-extend/",
    REFRESH: "api/users/login/refresh/",
    CSRF: "api/users/csrf/",
    LOGIN: "api/users/login/",
    LOGOUT: "api/users/logout/",
    REGISTER: "api/users/register/",
    PROFILE: "api/users/profile/",
    CHANGE_PASSWORD: "api/users/profile/change-password/",

    DASHBOARD_STATS: "api/servers/dashboard/stats/",
    SERVER_SEARCH: "api/servers/servers/search/",
    PACKAGE_SEARCH: "api/servers/software/search/",

    PATCHING_API_KEY_CREATE: "api/servers/patching/api-key/create/",
};