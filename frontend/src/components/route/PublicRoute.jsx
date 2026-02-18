import { Navigate, Outlet } from "react-router-dom";
import { ACCESS_TOKEN } from "../../utils/constants";
import { jwtDecode } from "jwt-decode";

function PublicRoute() {
    const token = localStorage.getItem(ACCESS_TOKEN);

    if (token) {
        try {
            const decoded = jwtDecode(token);
            const now = Date.now() / 1000;

            // If the token is still valid, redirect away from Login to Home
            if (decoded.exp > now) {
                return <Navigate to="/" replace />;
            }
            // If expired, we don't redirect to Home; we let the user stay on Login
        } catch (e) {
            localStorage.removeItem(ACCESS_TOKEN);
        }
    }

    return <Outlet />;
}

export default PublicRoute;