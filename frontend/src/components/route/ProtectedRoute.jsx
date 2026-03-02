import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import FullScreenLoader from "../FullScreenLoader";

function ProtectedRoute() {
    const { isAuthorized, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <FullScreenLoader label="Verifying session..." />;
    }

    // If not authorized, redirect to login
    if (!isAuthorized) {
        const redirectTo = location.pathname === "/logout" ? "/" : location;
        return <Navigate to="/login" state={{ from: redirectTo }} replace />;
    }

    return <Outlet />;
}

export default ProtectedRoute;