import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import SuccessToast from '../../components/SuccessToast';
import FullScreenLoader from "../../components/FullScreenLoader";

const Logout = () => {
    const { logoutUser } = useAuth();
    const [showSuccess, setShowSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const performLogout = async () => {
            await logoutUser();
            setShowSuccess(true);
            setTimeout(() => navigate("/login"), 1500);
        };

        performLogout();
    }, [navigate, logoutUser]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-900">
            {showSuccess ? (
                <SuccessToast message="Successfully logged out!" />
            ) : (
                <FullScreenLoader label="Securing your session..." />
            )}
        </div>
    );
};

export default Logout;