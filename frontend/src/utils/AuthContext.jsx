import { createContext, useState, useEffect, useContext } from "react";
import api from "./api";

const AuthContext = createContext();

// TODO: Fix the count down - checkAuth call. Ensure we aren't getting the 401, limit API calls
//          Order it hits the endpoints
//            401: GET - api/users/session-status/
//            200: POST - /api/login/refresh/
//            200: GET - api/users/session-status/

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [expiryTime, setExpiryTime] = useState(null); // Store the "Goal" time
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const res = await api.get("api/users/session-status/");
            setUser(res.data);
            // Calculate EXACT time the token dies: Current Time + Seconds Remaining
            setExpiryTime(Date.now() + (res.data.remaining_seconds * 1000));
        } catch (err) {
            setUser(null);
            setExpiryTime(null);
            try { await api.get("api/users/csrf/"); } catch (e) { }
        } finally {
            setLoading(false);
        }
    };

    // 1. Static Ticker: Just updates a "Now" timestamp every second
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // 2. Refresh Logic: Only fire when we actually cross the finish line
    useEffect(() => {
        if (user && expiryTime && currentTime >= expiryTime) {
            checkAuth();
        }
    }, [currentTime, expiryTime, user]);

    useEffect(() => {
        const handleForceLogout = () => { setUser(null); setExpiryTime(null); };
        window.addEventListener("force-logout", handleForceLogout);
        checkAuth();
        return () => window.removeEventListener("force-logout", handleForceLogout);
    }, []);

    // Helper: Difference between Goal and Now
    const getSecondsLeft = () => {
        if (!expiryTime) return 0;
        return Math.max(0, Math.floor((expiryTime - currentTime) / 1000));
    };

    const formatTime = () => {
        const totalSeconds = getSecondsLeft();
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