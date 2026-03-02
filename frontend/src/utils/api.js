import axios from "axios"

import { API_ENDPOINTS } from "./constants";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,

    xsrfCookieName: 'csrftoken',
    xsrfHeaderName: 'X-CSRFToken',
})

api.interceptors.request.use(
    (config) => config,
    (error) => Promise.reject(error)
);


const MAX_RETRIES = 2;

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        originalRequest._retryCount = originalRequest._retryCount || 0;

        // --- HANDLE 403 CSRF ERRORS ---
        const isCsrfError = error.response?.data?.detail?.includes("CSRF") ||
            error.response?.data?.message?.includes("CSRF");
        
        if (error.response?.status === 403 && isCsrfError && !originalRequest._csrfRetry) {
            originalRequest._csrfRetry = true;
            try {
                await api.get(API_ENDPOINTS.CSRF);
                return api(originalRequest);
            } catch (csrfError) {
                return Promise.reject(csrfError);
            }
        }

        // --- FATAL: REFRESH ENDPOINT FAILED ---
        // If the refresh call itself returns 401, we MUST logout immediately
        if (originalRequest.url.endsWith(API_ENDPOINTS.REFRESH)) {
            isRefreshing = false;
            processQueue(error, null);
            window.dispatchEvent(new CustomEvent("force-logout"));
            return Promise.reject(error);
        }

        // Handle 401 Errors
        if (error.response?.status === 401) {

            // If the request explicitly ask to skip refresh (e.g. on a public page),
            // stop here and don't call `API_ENDPOINTS.REFRESH`
            if (originalRequest._skipRefresh) {
                return Promise.reject(error);
            }

            // If we hit max retries, or if this is a background check AND the user is already null, 
            // just fail silently.
            if (originalRequest._retryCount >= MAX_RETRIES) {
                if (!originalRequest._isAuthCheck) {
                    window.dispatchEvent(new CustomEvent("force-logout"));
                }
                return Promise.reject(error);
            }

            originalRequest._retryCount++;

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => api(originalRequest)).catch(err => Promise.reject(err));
            }

            isRefreshing = true;

            try {
                await api.post(API_ENDPOINTS.REFRESH);
                isRefreshing = false;
                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                isRefreshing = false;
                processQueue(refreshError, null);

                // If the refresh failed, and it wasn't a background check, boot them.
                if (!originalRequest._isAuthCheck) {
                    window.dispatchEvent(new CustomEvent("force-logout"));
                }
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;