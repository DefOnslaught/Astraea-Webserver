import { Navigate, Outlet, useLocation } from "react-router-dom"
import { jwtDecode } from "jwt-decode"
import { useState, useEffect } from "react"

import api from "../../utils/api"
import { REFRESH_TOKEN, ACCESS_TOKEN } from "../../utils/constants"
import FullScreenLoader from "../FullScreenLoader"

function ProtectedRoute() {
    const [isAuthorized, setIsAuthorized] = useState(null)
    const location = useLocation();

    useEffect(() => {
        const auth = async () => {
            const token = localStorage.getItem(ACCESS_TOKEN)
            if (!token) {
                setIsAuthorized(false)
                return
            }

            try {
                const decoded = jwtDecode(token)
                const tokenExpiration = decoded.exp
                const now = Date.now() / 1000

                if (tokenExpiration < now) {
                    await refresh();
                } else {
                    setIsAuthorized(true)
                }
            } catch (e) {
                // If the token is malformed, clear everything
                localStorage.removeItem(ACCESS_TOKEN);
                localStorage.removeItem(REFRESH_TOKEN);
                setIsAuthorized(false)
            }
        }

        const refresh = async () => {
            const rToken = localStorage.getItem(REFRESH_TOKEN)
            if (!rToken) {
                setIsAuthorized(false)
                return
            }

            try {
                const response = await api.post("api/login/refresh/", {
                    refresh: rToken,
                });
                if (response.status === 200) {
                    localStorage.setItem(ACCESS_TOKEN, response.data.access)
                    setIsAuthorized(true)
                } else {
                    throw new Error("Failed to refresh");
                }
            } catch (error) {
                console.log("Refresh failed", error)
                // CRITICAL: Clear tokens so PublicRoute doesn't redirect back here
                localStorage.removeItem(ACCESS_TOKEN);
                localStorage.removeItem(REFRESH_TOKEN);
                setIsAuthorized(false)
            }
        }

        auth();
    }, []);

    if (isAuthorized === null) {
        return <FullScreenLoader />
    }

    // state={{ from: location }} allows Login.jsx to redirect the user back here
    return isAuthorized ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />
}

export default ProtectedRoute