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

        // --- HANDLE 403 CSRF ERRORS ---
        const isCsrfError = error.response?.data?.detail?.includes("CSRF") ||
            error.response?.data?.message?.includes("CSRF");
        
        if (error.response?.status === 403 && isCsrfError && !originalRequest._csrfRetry) {
            originalRequest._csrfRetry = true;
            try {
                // Fetch a fresh CSRF token
                await api.get('api/users/csrf/');
                // Retry the original request (Axios will now see the new cookie)
                return api(originalRequest);
            } catch (csrfError) {
                return Promise.reject(csrfError);
            }
        }

        // --- HANDLE 401 JWT ERRORS (Existing logic) ---
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
                processQueue(null);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                // Dispatch an event that the AuthContext can listen for
                window.dispatchEvent(new CustomEvent("force-logout", {
                    detail: { message: "Your session has expired. Please log in again." }
                }));
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;