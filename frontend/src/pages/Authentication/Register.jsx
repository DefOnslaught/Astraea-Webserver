import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";
import { useAuth } from "../../utils/AuthContext";
import useDocumentTitle from '../../utils/useDocumentTitle';
import SuccessToast from '../../components/SuccessToast';
import VerificationSent from "../Verification/VerificationSent";

const Register = () => {
    useDocumentTitle('Register | Astraea');


    const { checkAuth } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [sentData, setSentData] = useState({ email: '', expiry: 0 });
    const [isResent, setIsResent] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (errorMessage) {
            const timer = setTimeout(() => setErrorMessage(''), 5000);
            return () => clearTimeout(timer);
        }
    }, [errorMessage]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        
        if (password !== password2) {
            setErrorMessage("Passwords do not match.");
            return;
        }

        setLoading(true);
        setErrorMessage('');
        setIsResent(false);

        try {
            const response = await api.post(API_ENDPOINTS.REGISTER, {
                email,
                username,
                password,
                password_confirm: password2
            });

            const { requires_verification, expiry, message } = response.data;

            if (response.status === 201 && !requires_verification) {
                setShowSuccess(true);
                await checkAuth(true);
                setTimeout(() => navigate("/"), 2000);
            }
            else if (response.status === 201 && requires_verification) {
                setSentData({ email: response.data.email || email, expiry });
                setIsSent(true);
            }
            else if (response.status === 200) {
                setErrorMessage(response.data.message);
            }
        } catch (error) {
            if (error.response?.status === 405) {
                setErrorMessage("User account registration has been disabled.");
            } else {
                setErrorMessage(error.response?.data?.message || "Registration failed.");
            }
        } finally {
            setLoading(false);
        }
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

    const getPasswordStrength = (pwd) => {
        let s = 0;
        if (pwd.length >= 8) s++;           // Length (Weak)
        if (/[A-Z]/.test(pwd)) s++;         // Uppercase (Fair)
        if (/[0-9]/.test(pwd)) s++;         // Number (Good)
        if (/[^A-Za-z0-9]/.test(pwd)) s++;  // Special (Strong)
        return s;
    };

    const strength = getPasswordStrength(password);
    const passwordsMatch = password.length > 0 && password === password2;
    const allFieldsFilled = username && email && password && password2;
    const isFormInvalid = !allFieldsFilled || strength < 2 || !passwordsMatch;

    // Helper to determine color and label
    const strengthLevels = [
        { label: "Weak", color: "bg-red-500", width: "w-1/4" },
        { label: "Fair", color: "bg-orange-500", width: "w-2/4" },
        { label: "Good", color: "bg-yellow-500", width: "w-3/4" },
        { label: "Strong", color: "bg-emerald-500", width: "w-full" },
    ];

    const requirements = [
        { label: "At least 8 characters", met: password.length >= 8 },
        { label: "Contains an uppercase letter", met: /[A-Z]/.test(password) },
        { label: "Contains a number", met: /[0-9]/.test(password) },
        { label: "Contains a special character", met: /[^A-Za-z0-9]/.test(password) },
        { label: "Passwords match", met: passwordsMatch },
    ];

    if (isSent) {
        return <VerificationSent email={sentData.email} expiry={sentData.expiry} />;
    }

    return (
        <div className="flex min-h-screen flex-col justify-center items-center px-6 lg:px-8">
            {showSuccess && <SuccessToast message="Account Created! Redirecting..." />}

            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <h2 className="text-center text-2xl/9 font-bold tracking-tight text-gray-400">Create your account</h2>
            </div>

            <div className="mt-2 sm:mx-auto sm:w-full sm:max-w-sm relative group">
                
                {/* THE LOADING OVERLAY */}
                {loading && (
                    <div className="absolute inset-0 z-10 bg-gray-900/60 backdrop-blur-[2px] flex items-center justify-center rounded-xl transition-all">
                        <div className="flex flex-col items-center">
                            {/* A smaller version of your FullScreenLoader spinner */}
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-600 border-t-indigo-500"></div>
                            <p className="mt-2 text-xs font-bold text-indigo-400 tracking-widest animate-pulse">
                                CREATING ACCOUNT...
                            </p>
                        </div>
                    </div>
                )}

                <div className="h-14 mb-2 flex items-center justify-center">
                    {errorMessage && (
                        <div className="w-full p-2 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center">
                            <p className="mb-1">{errorMessage}</p>

                            {/* Conditional "Resend" button for the TODO */}
                            {errorMessage.includes("awaiting verification") && !isResent && (
                                <button
                                    onClick={handleResend}
                                    disabled={loading}
                                    className="mt-1 text-indigo-400 font-bold hover:text-indigo-300 underline underline-offset-2 transition-colors flex items-center justify-center gap-1 mx-auto"
                                >
                                    {loading ? <div className="h-2 w-2 animate-spin rounded-full border border-t-transparent" /> : null}
                                    Resend Verification Link
                                </button>
                            )}

                            {/* Success feedback after resending */}
                            {isResent && (
                                <p className="mt-1 text-emerald-400 font-bold animate-bounce">
                                    <i className="fa-solid fa-paper-plane mr-1"></i>
                                    New link sent!
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <form onSubmit={handleSubmit} className={`space-y-4 transition-opacity duration-300 ${loading ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    {/* Username Field */}
                    <div>
                        <label className="block text-sm/6 font-medium text-gray-400">Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-white outline-white/10 focus:outline-indigo-500 sm:text-sm/6"
                        />
                    </div>

                    {/* Email Field */}
                    <div>
                        <label className="block text-sm/6 font-medium text-gray-400">Email address</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            autoComplete="email"
                            className="block w-full rounded-md bg-white/5 px-3 py-1.5 text-white outline-white/10 focus:outline-indigo-500 sm:text-sm/6"
                        />
                    </div>

                    {/* Password Field */}
                    <div>
                        <label htmlFor="password" className="block text-sm/6 font-medium text-gray-400">
                            Password
                        </label>
                        <div className="mt-2 relative flex items-center">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="block w-full rounded-md bg-white/5 px-3 py-1.5 pr-10 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 text-gray-400 hover:text-white focus:outline-none"
                            >
                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>

                        {/* STRENGTH INDICATOR BAR */}
                        {password.length > 0 && (
                            <div className="mt-2">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                        Strength: {strengthLevels[strength - 1]?.label}
                                    </span>
                                </div>
                                <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-500 ease-out ${strengthLevels[strength - 1]?.color} ${strengthLevels[strength - 1]?.width}`}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {/* Password Requirements Checklist */}
                        {password.length > 0 && (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-white/5 pt-3">
                                {requirements.map((req, index) => (
                                    <div key={index} className="flex items-center gap-2 transition-all duration-300">
                                        <div className={`shrink-0 h-4 w-4 rounded-full flex items-center justify-center transition-colors ${req.met ? 'bg-emerald-500/20' : 'bg-gray-800'}`}>
                                            {req.met ? (
                                                <i className="fa-solid fa-check text-[10px] text-emerald-500"></i>
                                            ) : (
                                                <div className="h-1 w-1 bg-gray-600 rounded-full"></div>
                                            )}
                                        </div>
                                        <span className={`text-[11px] transition-colors ${req.met ? 'text-gray-300' : 'text-gray-500'}`}>
                                            {req.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Confirm Password Field */}
                    <div>
                        <div className="flex justify-between items-center">
                            <label htmlFor="password2" className="block text-sm/6 font-medium text-gray-400">
                                Confirm Password
                            </label>
                            {/* MATCH INDICATOR */}
                            {password2.length > 0 && (
                                <span className={`text-[10px] font-bold uppercase tracking-widest ${passwordsMatch ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {passwordsMatch ? 'Passwords Match' : 'No Match'}
                                </span>
                            )}
                        </div>
                        <div className="mt-2 relative flex items-center">
                            <input
                                id="password2"
                                name="password2"
                                type={showPassword2 ? "text" : "password"}
                                value={password2}
                                onChange={(e) => setPassword2(e.target.value)}
                                required
                                className={`block w-full rounded-md bg-white/5 px-3 py-1.5 pr-10 text-base text-white outline-1 -outline-offset-1 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 sm:text-sm/6 transition-all 
                                    ${password2.length > 0 ? (passwordsMatch ? 'outline-emerald-500/50 focus:outline-emerald-500' : 'outline-red-500/50 focus:outline-red-500') : 'outline-white/10 focus:outline-indigo-500'}`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword2(!showPassword2)}
                                className="absolute right-3 text-gray-400 hover:text-white focus:outline-none"
                            >
                                <i className={`fa-solid ${showPassword2 ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                            </button>
                        </div>
                    </div>

                    <div className="mt-2">
                        {password.length > 0 && strength < 3 && (
                            <p className="mt-2 text-center text-[11px] text-gray-500 italic">
                                Please include numbers or uppercase letters to continue.
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={loading || isFormInvalid || showSuccess}
                            className={`flex w-full justify-center rounded-md px-3 py-1.5 text-sm/6 font-semibold text-white shadow-sm transition-all duration-200
                                ${(loading || isFormInvalid || showSuccess)
                                    ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5"
                                    : "bg-indigo-500 hover:bg-indigo-400 focus-visible:outline-indigo-500 shadow-indigo-500/20 shadow-lg"
                                }`}
                        >
                            {loading ? (
                                "Creating Account..."
                            ) : showSuccess ? (
                                "Success!"
                            ) : !allFieldsFilled ? (
                                "Complete all fields"
                            ) : strength < 3 ? (
                                "Password too weak"
                            ) : !passwordsMatch ? (
                                "Passwords must match"
                            ) : (
                                "Register Account"
                            )}
                        </button>
                    </div>
                </form>
                
                <p className="mt-6 text-center text-sm text-gray-500">
                    Already have an account?{' '}
                    <a href="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">Sign in</a>
                </p>
            </div>
        </div>
    );
}

export default Register;