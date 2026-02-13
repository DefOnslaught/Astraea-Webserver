import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../api";
import { REFRESH_TOKEN, ACCESS_TOKEN } from "../../constants";
import SuccessToast from '../../components/SuccessToast';
import FullScreenLoader from "../../components/FullScreenLoader";

const Logout = () => {
    const [showSuccess, setShowSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const performLogout = async () => {
            try {
                const refreshToken = localStorage.getItem(REFRESH_TOKEN);

                await api.post('api/users/logout/', {
                    refresh: refreshToken
                });
            } catch (error) {
                console.error("Logout error (likely already expired):", error);
            } finally {
                localStorage.removeItem(ACCESS_TOKEN);
                localStorage.removeItem(REFRESH_TOKEN);

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