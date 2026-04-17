import { createContext, useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";

import api from "./api";
import { API_ENDPOINTS, REFRESH_TOKEN_LIFETIME_WARNING } from "./constants";
import { usePathCheck } from "../hooks/usePathCheck";
import SessionWarningModal from "../components/SessionWarningModal";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [expiryTime, setExpiryTime] = useState(null);// Access Token
    const [refreshExpiryTime, setRefreshExpiryTime] = useState(null); // Hard Logout
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [hasDismissedWarning, setHasDismissedWarning] = useState(false);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();
    const { isPublicPage, pathname } = usePathCheck();

    const handleClearingValues = () => {
        setUser(null);
        setExpiryTime(null);
        setRefreshExpiryTime(null);
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
            setRefreshExpiryTime(Date.now() + (res.data.refresh_remaining * 1000));
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


    const extendSession = async () => {
        try {
            const res = await api.post(API_ENDPOINTS.SESSION_EXTEND);
            await checkAuth(true);
            setShowWarningModal(false);
            setHasDismissedWarning(false);
            return true;
        } catch (err) {
            return false;
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
        setHasDismissedWarning(false);
    }, [refreshExpiryTime]);

    // Watch for Refresh Token expiration
    useEffect(() => {
        // PREVENT MODAL ON LOGOUT/LOGIN/REGISTER PATHS
        const isSystemPage = ["/logout", "/login", "/register"].includes(pathname) || pathname.startsWith('/verify/');

        if (!refreshExpiryTime || !user || hasDismissedWarning || isSystemPage) {
            // If we are on a system page, ensure the modal is closed
            if (isSystemPage && showWarningModal) setShowWarningModal(false);
            return;
        }

        const secondsLeft = Math.floor((refreshExpiryTime - currentTime) / 1000);

        // Trigger warning modal when 5 minutes are left (300 seconds)
        if (secondsLeft <= REFRESH_TOKEN_LIFETIME_WARNING && secondsLeft > 0 && !showWarningModal) {
            setShowWarningModal(true);
        }

        // Force logout if it hits 0
        if (secondsLeft <= 0) {
            setShowWarningModal(false);
            window.dispatchEvent(new Event("force-logout"));
        }
    }, [currentTime, refreshExpiryTime, user, showWarningModal, hasDismissedWarning, pathname]);

    useEffect(() => {
        const handleForceLogout = () => {
            if (pathname === "/logout" || pathname === "/login" || pathname === "/register" || pathname.startsWith('/verify/')) {
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

    const dismissWarning = () => {
        setShowWarningModal(false);
        setHasDismissedWarning(true);
    };

    return (
        <AuthContext.Provider value={{
            user,
            setUser,
            isAuthorized: !!user,
            loading,
            checkAuth,
            timeLeft: getSecondsLeft(),
            formattedTime: formatTime(),
            showWarningModal,
            setShowWarningModal,
            dismissWarning,
            extendSession,
            refreshTimeLeft: Math.max(0, Math.floor((refreshExpiryTime - currentTime) / 1000))
        }}>
            {children}
            {showWarningModal && <SessionWarningModal />}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);