import { createContext, useState, useEffect, useContext } from "react";
import api from "./api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const res = await api.get("api/users/session-status/");
            setUser(res.data);
            setTimeLeft(res.data.remaining_seconds);
        } catch (err) {
            setUser(null);
            // If the user isn't logged in (401), we still want to 
            // ensure we have a CSRF token for their future login attempt
            try {
                await api.get("api/users/csrf/");
            } catch (csrfErr) {
                console.error("Failed to fetch CSRF token", csrfErr);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let interval = null;

        if (user && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        } else if (timeLeft === 0 && user) {
            // Optional: When access token hits 0, the interceptor will 
            // likely refresh it on the next request. You could trigger a 
            // checkAuth() here to refresh the UI timer after a refresh.
            checkAuth();
        }

        return () => clearInterval(interval);
    }, [user, timeLeft]);

    useEffect(() => { 
        const handleForceLogout = (event) => {
            setUser(null);
            if (event.detail?.message) {
                // Optional: Show a "Session Expired" notification here, i.e toast
            }
        };

        window.addEventListener("force-logout", handleForceLogout);
        checkAuth(); 

        return () => window.removeEventListener("force-logout", handleForceLogout);
    }, []);

    // Helper to format seconds to MM:SS
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s < 10 ? "0" : ""}${s}s`;
    };

    return (
        <AuthContext.Provider value={{ user, setUser, isAuthorized: !!user, loading, checkAuth, timeLeft, formattedTime: formatTime(timeLeft) }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);