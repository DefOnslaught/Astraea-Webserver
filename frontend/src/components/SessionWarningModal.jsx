import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faTriangleExclamation,
    faCircleNotch,
    faClockRotateLeft
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../utils/AuthContext";

const SessionWarningModal = () => {
    const { refreshTimeLeft, dismissWarning, extendSession } = useAuth();
    const [isExtending, setIsExtending] = useState(false);
    const navigate = useNavigate();

    const minutes = Math.floor(refreshTimeLeft / 60);
    const seconds = refreshTimeLeft % 60;

    // Lock background scrolling
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    const handleLogoutNow = () => {
        dismissWarning();
        navigate('/logout');
    };

    const handleExtend = async () => {
        setIsExtending(true);
        const success = await extendSession();
        if (!success) {
            navigate('/logout');
        }
        setIsExtending(false);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-9999 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-amber-500/50 p-8 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                <div className="flex items-center gap-4 text-amber-500 mb-4">
                    <FontAwesomeIcon icon={faTriangleExclamation} className="text-3xl" />
                    <h2 className="text-xl font-bold">Session Expiring</h2>
                </div>
                <p className="text-gray-300 mb-6">
                    For your security, your session will expire in
                    <span className="font-mono font-bold text-white px-2">
                        {minutes}m {seconds < 10 ? "0" : ""}{seconds}s
                    </span>.
                    Please save your work.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleExtend}
                        disabled={isExtending}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        {isExtending ? (
                            <FontAwesomeIcon icon={faCircleNotch} className="animate-spin" />
                        ) : (
                                <FontAwesomeIcon icon={faClockRotateLeft} />
                        )}
                        Extend Session
                    </button>

                    <button
                        onClick={handleLogoutNow}
                        className="w-full py-3 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition-colors"
                    >
                        Logout Now
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SessionWarningModal;