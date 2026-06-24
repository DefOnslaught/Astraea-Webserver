import { useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faRotateRight, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import useDocumentTitle from "../../utils/useDocumentTitle";
import { API_ENDPOINTS } from "../../utils/constants";
import api from "../../utils/api";

const ForgotPassword = () => {
    useDocumentTitle('Forgot Password | Astraea');

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isSent, setIsSent] = useState(false);
    const [expires, setExpires] = useState(null);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage('');

        try {
            const response = await api.post(API_ENDPOINTS.FORGOT_PASSWORD_EMAIL, { email });
            if (response.status === 200) {
                setIsSent(true);
                setExpires(response.data.expires);
            }
        } catch (error) {
            const msg = error.response?.data?.message || "Unable to process request. Please check the email and try again.";
            setErrorMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    const formatExpiry = (totalMinutes) => {
        if (!totalMinutes) return null;

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        const parts = [];

        if (hours > 0) {
            parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
        }
        if (minutes > 0) {
            parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
        }

        return parts.join(" and ");
    };

    return (
        <div className="flex min-h-screen flex-col justify-center items-center px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm mb-8 text-center">
                <h2 className="text-2xl font-bold tracking-tight text-gray-400">Reset your password</h2>
                <p className="mt-2 text-sm text-gray-500">Enter your account email to receive instructions.</p>
            </div>

            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                {!isSent ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errorMessage && (
                            <div className="w-full p-2 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center">
                                {errorMessage}
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-400">Email address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="mt-2 block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
                                placeholder="name@company.com"
                            />
                        </div>

                        <button
                            type="submit"
                            // Disable if loading OR if the email field is empty
                            disabled={loading || !email}
                            className={`flex w-full justify-center rounded-md px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-all duration-200
                                ${(loading || !email)
                                    ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5" // Greyed out state
                                    : "bg-indigo-500 hover:bg-indigo-400 focus-visible:outline-indigo-500" // Active state
                                }
                            `}
                        >
                            {loading ? "Sending..." : "Send Reset Link"}
                        </button>
                    </form>
                ) : (
                        <div className="text-center space-y-4 animate-in fade-in duration-500">
                            <div className="flex justify-center text-green-500 text-4xl mb-4">
                                <FontAwesomeIcon icon={faCheckCircle} />
                            </div>

                            <div className="text-sm text-gray-400 space-y-2">
                                <p>
                                    Reset instructions sent to <br />
                                    <span className="text-indigo-400 font-semibold">{email}</span>
                                </p>
                                {expires && (
                                    <p className="text-xs text-gray-500 italic">
                                        Link expires in {formatExpiry(expires)}.
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex w-full justify-center rounded-md bg-white/5 px-3 py-1.5 text-sm font-semibold text-gray-300 hover:bg-white/10 transition-all"
                            >
                                <FontAwesomeIcon icon={faRotateRight} className={`mr-2 ${loading ? "animate-spin" : ""}`} />
                                {loading ? "Resending..." : "Resend Email"}
                            </button>
                        </div>
                )}

                <div className="mt-10 text-center">
                    <Link to="/login" className="text-sm font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faArrowLeft} />
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;