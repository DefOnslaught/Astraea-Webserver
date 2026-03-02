import { createContext, useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";

import api from "./api";
import { API_ENDPOINTS } from "./constants";
import { usePathCheck } from "../hooks/usePathCheck";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [expiryTime, setExpiryTime] = useState(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();
    const { isPublicPage, pathname } = usePathCheck();

    const handleClearingValues = () => {
        setUser(null);
        setExpiryTime(null);
    };

    const checkAuth = async (force = false) => {

        if (user && !force) return;

        // If we're on a public page and already know the user, don't re-check
        if (isPublicPage && user && !force) {
            setLoading(false);
            return;
        }

        try {
            const res = await api.get(API_ENDPOINTS.SESSION_STATUS, { 
                _isAuthCheck: true,
                _skipRefresh: isPublicPage,
             });
            setUser(res.data);
            setExpiryTime(Date.now() + (res.data.remaining_seconds * 1000));
        } catch (err) {
            handleClearingValues();
            // Only fetch CSRF if we are actually on a login/register page
            if (isPublicPage) {
                try { await api.get(API_ENDPOINTS.CSRF); } catch (e) { }
            }
        } finally {
            setLoading(false);
        }
    };

    // 1. Initial Load Only
    useEffect(() => {
        checkAuth();
    }, []);

    // 2. The Clock (Derived state to keep things light)
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // 2. Logic: Only fire if we have a valid session to refresh
    useEffect(() => {
        // Only run if user exists AND we have a valid expiryTime to compare against
        if (user && expiryTime && currentTime >= expiryTime) {
            // Immediately nullify expiryTime so this EFFECT cannot trigger again 
            // while the API call is in flight.
            setExpiryTime(null);
            checkAuth(true);
        }
    }, [currentTime, expiryTime, user]);


    useEffect(() => {
        const handleForceLogout = () => {
            if (pathname === "/logout" || pathname === "/login" || pathname === "/register") {
                handleClearingValues();
                return;
            }
            handleClearingValues();
            navigate("/login", { replace: true, state: { message: "Expired" } });
        };

        window.addEventListener("force-logout", handleForceLogout);
        return () => window.removeEventListener("force-logout", handleForceLogout);
    }, [navigate, pathname]);

    const getSecondsLeft = () => {
        if (!expiryTime) return 0;
        return Math.max(0, Math.floor((expiryTime - currentTime) / 1000));
    };

    const formatTime = () => {
        const totalSeconds = getSecondsLeft();
        if (totalSeconds <= 0 && user) return "Syncing...";
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m}m ${s < 10 ? "0" : ""}${s}s`;
    };

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            isAuthorized: !!user,
            loading,
            checkAuth,
            timeLeft: getSecondsLeft(),
            formattedTime: formatTime()
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);