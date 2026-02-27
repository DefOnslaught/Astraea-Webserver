import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import FullScreenLoader from "../FullScreenLoader";

function PublicRoute() {
    const { isAuthorized, loading } = useAuth();

    if (loading) {
        return <FullScreenLoader />;
    }

    // If logged in, send them to Home
    return isAuthorized ? <Navigate to="/" replace /> : <Outlet />;
}

export default PublicRoute;