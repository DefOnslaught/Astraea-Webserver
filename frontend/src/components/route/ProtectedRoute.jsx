import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import FullScreenLoader from "../FullScreenLoader";

function ProtectedRoute() {
    const { isAuthorized, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return <FullScreenLoader label="Verifying session..." />;
    }

    return isAuthorized
        ? <Outlet />
        : <Navigate to="/login" state={{ from: location }} replace />;
}

export default ProtectedRoute;