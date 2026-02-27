import { createContext, useState, useEffect, useContext } from "react";
import api from "./api";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            const res = await api.get("api/users/basic-info/");
            setUser(res.data);
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

    return (
        <AuthContext.Provider value={{ user, setUser, isAuthorized: !!user, loading, checkAuth }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);