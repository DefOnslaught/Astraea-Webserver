import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faEye, faEyeSlash, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import useDocumentTitle from "../../utils/useDocumentTitle";
import { API_ENDPOINTS } from "../../utils/constants";
import api from "../../utils/api";

const ForgotPasswordReset = () => {
    useDocumentTitle('Reset Password | Astraea');

    const { token } = useParams();
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showSuccess, setShowSuccess] = useState(false);

    const getPasswordStrength = (pwd) => {
        let s = 0;
        if (pwd.length >= 8) s++;
        if (/[A-Z]/.test(pwd)) s++;
        if (/[0-9]/.test(pwd)) s++;
        if (/[^A-Za-z0-9]/.test(pwd)) s++;
        return s;
    };

    const strength = getPasswordStrength(password);
    const passwordsMatch = password.length > 0 && password === password2;
    const allFieldsFilled = password && password2;
    const isFormInvalid = !allFieldsFilled || strength < 3 || !passwordsMatch;

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
    ];

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setErrorMessage('');
        try {
            const response = await api.post(API_ENDPOINTS.FORGOT_PASSWORD_RESET, { token, password });
            if (response.status === 200) setShowSuccess(true);
        } catch (error) {
            setErrorMessage(error.response?.data?.message || "Unable to reset password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col justify-center items-center px-6">
            <div className="sm:max-w-sm w-full">
                {!showSuccess ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <h2 className="text-2xl font-bold text-gray-400">Set new password</h2>

                        {errorMessage && (
                            <div className="p-2 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-xs text-center">
                                {errorMessage}
                            </div>
                        )}

                        {/* Password 1 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-400">New Password</label>
                            <div className="mt-2 relative flex items-center">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className={`block w-full rounded-md bg-white/5 px-3 py-1.5 pr-10 text-white outline-1 -outline-offset-1 transition-all ${password.length > 0
                                            ? (strength >= 3 ? 'outline-emerald-500/50 focus:outline-emerald-500' : 'outline-yellow-500/50 focus:outline-yellow-500')
                                            : 'outline-white/10 focus:outline-indigo-500'
                                        } sm:text-sm`}
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 text-gray-400"
                                >
                                    <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                                </button>
                            </div>

                            {/* STRENGTH INDICATOR BAR */}
                            {password.length > 0 && (
                                <div className="mt-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Strength: {strengthLevels[Math.min(strength, 4) - 1]?.label}</span>
                                    </div>
                                    <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
                                        <div className={`h-full transition-all duration-500 ${strengthLevels[Math.min(strength, 4) - 1]?.color} ${strengthLevels[Math.min(strength, 4) - 1]?.width}`}></div>
                                    </div>
                                </div>
                            )}

                            {/* REQUIREMENTS GRID */}
                            {password.length > 0 && (
                                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-white/5 pt-3">
                                    {requirements.map((req, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className={`h-4 w-4 rounded-full flex items-center justify-center ${req.met ? 'bg-emerald-500/20' : 'bg-gray-800'}`}>
                                                {req.met && <FontAwesomeIcon icon={faCheck} className="text-[10px] text-emerald-500" />}
                                            </div>
                                            <span className={`text-[11px] ${req.met ? 'text-gray-300' : 'text-gray-500'}`}>{req.label}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Confirm Password Field */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-400">Confirm Password</label>
                                {password2.length > 0 && (
                                    <span className={`text-[10px] font-bold uppercase ${passwordsMatch ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {passwordsMatch ? 'Passwords Match' : 'No Match'}
                                    </span>
                                )}
                            </div>

                            <div className="relative flex items-center">
                                <input
                                    type={showPassword2 ? "text" : "password"}
                                    value={password2}
                                    onChange={(e) => setPassword2(e.target.value)}
                                    required
                                    className={`block w-full rounded-md bg-white/5 px-3 py-1.5 pr-10 text-white outline-1 -outline-offset-1 transition-all ${password2.length > 0 ? (passwordsMatch ? 'outline-emerald-500/50 focus:outline-emerald-500' : 'outline-red-500/50 focus:outline-red-500') : 'outline-white/10 focus:outline-indigo-500'} sm:text-sm`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword2(!showPassword2)}
                                    className="absolute right-3 text-gray-400 hover:text-white"
                                >
                                    <FontAwesomeIcon icon={showPassword2 ? faEyeSlash : faEye} />
                                </button>
                            </div>
                        </div>

                        <button disabled={isFormInvalid || loading} className="w-full bg-indigo-500 disabled:bg-gray-800 p-2 rounded text-white font-semibold transition-all">
                            {loading ? "Updating..." : "Reset Password"}
                        </button>
                    </form>
                ) : (
                    <div className="text-center space-y-4">
                        <FontAwesomeIcon icon={faCheckCircle} className="text-4xl text-green-500" />
                        <p className="text-gray-400">Password successfully updated!</p>
                        <Link to="/login" className="text-indigo-400 font-bold underline">Go to Login</Link>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ForgotPasswordReset;