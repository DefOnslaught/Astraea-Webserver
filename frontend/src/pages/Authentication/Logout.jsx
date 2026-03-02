import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";
import { useAuth } from "../../utils/AuthContext";
import SuccessToast from '../../components/SuccessToast';
import FullScreenLoader from "../../components/FullScreenLoader";

const Logout = () => {
    const { setUser } = useAuth();
    const [showSuccess, setShowSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const performLogout = async () => {
            try {
                await api.post(API_ENDPOINTS.LOGOUT);
            } catch (error) {
                console.error("Logout error (likely already expired):", error);
            } finally {
                setUser(null);
                setShowSuccess(true);
                setTimeout(() => navigate("/login"), 1500);
            }
        };

        performLogout();
    }, [navigate]);

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