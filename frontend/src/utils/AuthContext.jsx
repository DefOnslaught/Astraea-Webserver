import { createContext, useState, useEffect, useContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "./api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [expiryTime, setExpiryTime] = useState(null);
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [loading, setLoading] = useState(true);

    const location = useLocation();
    const navigate = useNavigate();
    const isPublicPage = ["/login", "/register"].includes(location.pathname);

    const handleClearingValues = () => {
        setUser(null);
        setExpiryTime(null);
    };

    const checkAuth = async (force = false) => {

        try {
            if (isPublicPage && !force) return;

            const res = await api.get("api/users/session-status/");
            setUser(res.data);
            setExpiryTime(Date.now() + (res.data.remaining_seconds * 1000));
        } catch (err) {    
            // Only fetch CSRF if we are actually on a login/register page
            if (isPublicPage) {
                try { await api.get("api/users/csrf/"); } catch (e) { }
            }
        } finally {
            setLoading(false);
        }
    };

    // 1. The Clock (Derived state to keep things light)
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
            checkAuth();
        }
    }, [currentTime, expiryTime, user]);

    // 3. Logic: Re-run checkAuth when navigating to a new page
    // This ensures that if they were on /login and went to /, we check their status.
    useEffect(() => {
        checkAuth();
    }, [location.pathname]);


    useEffect(() => {
        const handleForceLogout = () => {
            handleClearingValues();
            navigate("/login", { replace: true, state: { message: "Expired" } });
        };

        window.addEventListener("force-logout", handleForceLogout);
        return () => window.removeEventListener("force-logout", handleForceLogout);
    }, [navigate]);

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