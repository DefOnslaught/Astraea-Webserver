export const PUBLIC_PATHS = ["/login", "/register"];
export const AUTH_PAGES = ["/login", "/register", "/logout"]

export const API_ENDPOINTS = {
    SESSION_STATUS: "api/users/session-status/",
    REFRESH: "api/users/login/refresh/",
    CSRF: "api/users/csrf/",
    LOGIN: "api/users/login/",
    LOGOUT: "api/users/logout/",
    REGISTER: "api/users/register/",

    DASHBOARD_STATS: "api/servers/dashboard/stats/",
    SERVER_SEARCH: "api/servers/servers/search/",
    PACKAGE_SEARCH: "api/servers/software/search/",

    PATCHING_API_KEY_CREATE: "api/servers/patching/api-key/create/",
};