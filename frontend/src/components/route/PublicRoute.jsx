import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import FullScreenLoader from "../FullScreenLoader";

function PublicRoute() {
    const { isAuthorized, loading } = useAuth();

    if (loading) {
        return <FullScreenLoader />;
    }

    // If authorized, only redirect to "/" if there isn't a "from" destination
    // already being handled by the Login component's logic.
    if (isAuthorized) {
        const from = location.state?.from?.pathname;
        
        // If we don't have a 'from' path, go home.
        // If we DO have a 'from' path, stay put and let Login.jsx handle it.
        if (!from || from === "/login") {
            return <Navigate to="/" replace />;
        }
    }

    return <Outlet />;
}

export default PublicRoute;