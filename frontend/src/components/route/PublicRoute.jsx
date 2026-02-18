import { Navigate, Outlet } from "react-router-dom";
import { ACCESS_TOKEN } from "../../utils/constants";

function PublicRoute() {
    const token = localStorage.getItem(ACCESS_TOKEN);

    // If token exists, user is already logged in, redirect to home
    if (token) {
        return <Navigate to="/" />;
    }

    // If no token, allow access to Login/Register
    return <Outlet />;
}

export default PublicRoute;