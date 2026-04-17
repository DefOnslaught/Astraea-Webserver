import { useState } from "react";
import useDocumentTitle from "../../utils/useDocumentTitle";
import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";

const VerificationSent = ({ email, expiry }) => {
    useDocumentTitle('Verification Sent | Astraea');

    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isResent, setIsResent] = useState(false);

    const formatExpiry = (minutes) => {
        if (!minutes || minutes <= 0) return "no expiry";

        const units = [
            { label: "year", seconds: 365 * 24 * 60 * 60 },
            { label: "month", seconds: 30 * 24 * 60 * 60 },
            { label: "day", seconds: 24 * 60 * 60 },
            { label: "hour", seconds: 60 * 60 },
            { label: "minute", seconds: 60 },
        ];

        let seconds = minutes * 60;
        const result = [];

        for (const { label, seconds: unitSecs } of units) {
            if (seconds >= unitSecs) {
                const count = Math.floor(seconds / unitSecs);
                result.push(`${count} ${label}${count > 1 ? 's' : ''}`);
                seconds %= unitSecs;
            }
        }
        return result.slice(0, 2).join(", ");
    };

    const handleResend = async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage('');
        setIsResent(false);

        try {
            const data = { 'email': email };
            const response = await api.post(API_ENDPOINTS.RESEND_VERIFICATION, data);

            if (response.status === 200) {
                setIsResent(true);
            }
        } catch (error) {
            const msg = error.response?.data?.message || "Unable to resend email.";
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col justify-center items-center px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm text-center">

                {/* Icon Section */}
                <div className="mx-auto h-16 w-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6">
                    <i className="fa-solid fa-paper-plane text-indigo-400 text-2xl animate-bounce-slow"></i>
                </div>

                <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Check your email</h2>
                <p className="text-gray-400 text-sm mb-6">
                    We've sent a verification link to <br />
                    <span className="text-indigo-300 font-mono font-semibold">{email}</span>
                </p>

                {/* Expiry Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8">
                    <i className="fa-regular fa-clock text-xs text-gray-500"></i>
                    <span className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">
                        Link Expires in: {formatExpiry(expiry)}
                    </span>
                </div>

                {errorMessage && (
                    <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center animate-pulse">
                        {errorMessage}
                    </div>
                )}

                {isResent ? (
                    <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 text-xs font-semibold mb-6">
                        <i className="fa-solid fa-check-circle mr-2"></i>
                        A new link has been dispatched!
                    </div>
                ) : (
                    <button
                        onClick={handleResend}
                        disabled={loading}
                        className={`w-full py-3 rounded-md text-sm font-semibold transition-all duration-200 
                            ${loading
                                ? "bg-gray-800 text-gray-500 cursor-not-allowed"
                                : "bg-white/5 text-white hover:bg-white/10 border border-white/10"}`}
                    >
                        {loading ? "Sending..." : "Resend verification email"}
                    </button>
                )}

                <div className="mt-8 pt-6 border-t border-white/5">
                    <p className="text-xs text-gray-500">
                        Can't find the email? Check your spam folder or wait a few minutes.
                    </p>
                    <a href="/login" className="mt-4 inline-block text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                        Back to sign in
                    </a>
                </div>
            </div>
        </div>
    );
};

export default VerificationSent;