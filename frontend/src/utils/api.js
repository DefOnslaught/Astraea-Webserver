import axios from "axios"

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

        // 1. IMPROVED REFRESH FAILURE CHECK
        if (originalRequest.url.endsWith('api/login/refresh/')) {
            console.log("FATAL: Refresh token is expired or invalid.");
            isRefreshing = false;
            processQueue(error, null); // Clear the queue with error
            window.dispatchEvent(new CustomEvent("force-logout"));
            return Promise.reject(error);
        }

        // --- HANDLE 403 CSRF ERRORS ---
        const isCsrfError = error.response?.data?.detail?.includes("CSRF") ||
            error.response?.data?.message?.includes("CSRF");
        
        if (error.response?.status === 403 && isCsrfError && !originalRequest._csrfRetry) {
            originalRequest._csrfRetry = true;
            try {
                await api.get('api/users/csrf/');
                return api(originalRequest);
            } catch (csrfError) {
                return Promise.reject(csrfError);
            }
        }

        // --- HANDLE 401 JWT ERRORS ---
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => api(originalRequest))
                    .catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await api.post('api/login/refresh/');
                isRefreshing = false;
                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                isRefreshing = false;
                processQueue(refreshError, null);
                window.dispatchEvent(new CustomEvent("force-logout"));
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;