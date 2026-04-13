import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";
import { useAuth } from "../../utils/AuthContext";
import useDocumentTitle from '../../utils/useDocumentTitle';
import SuccessToast from '../../components/SuccessToast';

const Login = () => {

    useDocumentTitle('Login | Astraea');

    const { checkAuth } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from?.pathname || "/";

    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage('');

        try {
            const response = await api.post(API_ENDPOINTS.LOGIN, { email, password })
            if (response.status === 200) {
                await checkAuth(true);
                setShowSuccess(true);
                // Redirect to 'from' (the original page they tried to visit)
                setTimeout(() => navigate(from, { replace: true }), 500);
            } else {
                setErrorMessage(response?.data?.message || "Invalid Username or Password.");
            }
        } catch (error) {
            if (error.response && error.response.status === 406) {
                setErrorMessage(error.response.data.message);
            } else if (error.response?.data?.message) {
                const msg = error.response.data.message;
                setErrorMessage(typeof msg === 'object' ? Object.values(msg)[0] : msg);
            } else {
                setErrorMessage("An unexpected error occurred. Please try again.");
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen flex-col justify-center items-center px-6 lg:px-8">
            {showSuccess && <SuccessToast message="Signed In! Redirecting..." />}

            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <h2 className="text-center text-2xl/9 font-bold tracking-tight text-gray-400">Sign in to your account</h2>
            </div>

            <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-sm relative group">

                {/* THE LOADING OVERLAY */}
                {loading && (
                    <div className="absolute inset-0 z-10 bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center rounded-xl transition-all">
                        <div className="flex flex-col items-center">
                            {/* A smaller version of your FullScreenLoader spinner */}
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-600 border-t-indigo-500"></div>
                            <p className="mt-2 text-xs font-bold text-indigo-400 tracking-widest animate-pulse">
                               SIGNING IN...
                            </p>
                        </div>
                    </div>
                )}

                <div className="h-12 mb-2 flex items-center justify-center">
                    {errorMessage && (
                        <div className="w-full p-2 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center animate-pulse">
                            {errorMessage}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className={`space-y-4 transition-opacity duration-300 ${loading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <div>
                        <label htmlFor="email" className="block text-sm/6 font-medium text-gray-400">
                            Email address
                        </label>
                        <div className="mt-2">
                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="password" className="block text-sm/6 font-medium text-gray-400">
                                Password
                            </label>
                            <div className="text-sm">
                                <a href="#" className="font-semibold text-indigo-400 hover:text-indigo-300">
                                    Forgot password?
                                </a>
                            </div>
                        </div>
                        <div className="mt-2 relative flex items-center">
                            <input
                                id="password"
                                name="password"
                                // Toggle type between 'password' and 'text'
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="block w-full rounded-md bg-white/5 px-3 py-1.5 pr-10 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
                            />

                            {/* Toggle Button */}
                            <button
                                type="button" // Important: set type to button so it doesn't submit the form
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 text-gray-400 hover:text-white focus:outline-none"
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            // Disable if loading, success, or if fields are empty
                            disabled={loading || showSuccess || !email || !password}
                            className={`mt-2 flex w-full justify-center rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm transition-all duration-200
                                ${(loading || showSuccess || !email || !password)
                                    ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5"
                                    : "bg-indigo-500 hover:bg-indigo-400 focus-visible:outline-indigo-500 shadow-indigo-500/20 shadow-lg"
                                }`}
                        >
                            {loading ? (
                                "Signing in..."
                            ) : showSuccess ? (
                                "Success!"
                            ) : (
                                "Sign in"
                            )}
                        </button>
                    </div>
                </form>

                <p className="mt-10 text-center text-sm/6 text-gray-400">
                    Not registered?{' '}
                    <a href="/register" className="font-semibold text-indigo-400 hover:text-indigo-300">
                        Register Here
                    </a>
                </p>

            </div>
        </div>
    );
};

export default Login;