import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

import api from "../../utils/api";
import { useAuth } from "../../utils/AuthContext";
import { API_ENDPOINTS } from "../../utils/constants";
import useDocumentTitle from "../../utils/useDocumentTitle";
import SuccessToast from "../../components/SuccessToast";


const VerifyLink = () => {
    
    const { token } = useParams();
    const { checkAuth } = useAuth();
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [isResent, setIsResent] = useState(false);
    const [email, setEmail] = useState('');
    const [showResend, setShowResend] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage('');

        try {
            const data = { 'token': token };
            const response = await api.post(API_ENDPOINTS.VERIFY_LINK, data)

            if (response.status === 200) {
                setShowSuccess(true);
                await checkAuth(true);
                setTimeout(() => navigate('/', { replace: true }), 1000);
            }
        } catch (error) {
            const msg = error.response?.data?.message || "Unable to process verification request.";
            setErrorMessage(msg)
            if (error.response?.status === 418) {
                setShowResend(true);
            }
            // TODO We need a method to display a button to have a resend request, with a field for the user to enter their email
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async (event) => {
        event.preventDefault();
        if (!email) {
            setErrorMessage("Please enter your email address.");
            return;
        }

        setLoading(true);
        setErrorMessage('');
        setIsResent(false);

        try {
            const data = { 'email': email };
            const response = await api.post(API_ENDPOINTS.RESEND_VERIFICATION, data);

            if (response.status === 200) {
                setIsResent(true);
                setErrorMessage('');
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
            {showSuccess && <SuccessToast message="Successfully Verified! Redirecting..." />}

            <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm">
                <div className="text-center mb-8">
                    <div className="mx-auto h-12 w-12 rounded-full bg-indigo-500/20 flex items-center justify-center mb-4">
                        <i className={`fa-solid ${showResend && !showSuccess ? 'fa-envelope-open-text' : 'fa-user-check'} text-indigo-400 text-xl`}></i>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">
                        {showResend && !showSuccess ? "Verification Issue" : "Confirm Verification"}
                    </h2>
                    <p className="mt-2 text-sm text-gray-400">
                        {showResend && !showSuccess
                            ? "Your link may be expired or invalid. Request a new one below."
                            : "Click the button below to activate your Astraea account and finish the setup."}
                    </p>
                </div>

                {errorMessage && (
                    <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-[11px] text-center animate-pulse">
                        <i className="fa-solid fa-triangle-exclamation mr-2"></i>
                        {errorMessage}
                    </div>
                )}

                {isResent ? (
                    <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/50 text-emerald-500 text-sm text-center">
                        <i className="fa-solid fa-paper-plane mr-2"></i>
                        A new link has been sent to your email.
                    </div>
                ) : showResend && !showSuccess ? (
                    /* RESEND FORM */
                    <form onSubmit={handleResend} className="space-y-4">
                        <div>
                            <label className="block text-sm/6 font-medium text-gray-400">Email address</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full rounded-md bg-white/5 px-3 py-1.5 pr-10 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
                                placeholder="name@example.com"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full justify-center rounded-md bg-indigo-600 px-3 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 transition-all active:scale-[0.98] disabled:opacity-50"
                        >
                            {loading ? "Sending..." : "Send New Link"}
                        </button>
                    </form>
                ) : (
                    /* INITIAL VERIFY FORM */
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <button
                            type="submit"
                            disabled={loading || showSuccess}
                            className={`group relative flex w-full justify-center rounded-md px-3 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200
                                ${(loading || showSuccess)
                                    ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5"
                                    : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20 shadow-lg active:scale-[0.98]"
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-white"></div>
                                    Verifying...
                                </span>
                            ) : showSuccess ? (
                                "Identity Confirmed"
                            ) : (
                                "Verify My Account"
                            )}
                        </button>
                    </form>
                )}

                <div className="mt-8 pt-6 border-t border-white/5 text-center flex flex-col gap-3">
                    {showResend && !showSuccess && !isResent && (
                        <button
                            onClick={() => { setShowResend(false); setErrorMessage(''); }}
                            className="text-[11px] text-gray-500 hover:text-white transition-colors"
                        >
                            Try verifying again
                        </button>
                    )}
                    <Link
                        to="/login"
                        className="text-xs font-medium text-gray-500 hover:text-indigo-400 transition-colors"
                    >
                        <i className="fa-solid fa-arrow-left mr-2"></i>
                        Back to Login
                    </Link>
                </div>
            </div>

            <div className="fixed top-0 left-0 -z-10 h-full w-full overflow-hidden opacity-20 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 h-64 w-64 bg-indigo-500 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-1/4 right-1/4 h-64 w-64 bg-purple-500 rounded-full blur-[120px]"></div>
            </div>
        </div>
    );
};

export default VerifyLink;