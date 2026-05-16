import { useState, useEffect } from "react";
import {
    X, UserPlus, Mail, User, Loader2,
    AlertTriangle, Eye, EyeOff, Check, Circle
} from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";

const CreateUserModal = ({ isOpen, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({ username: "", email: "", password: "", password_confirm: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // --- Validation Logic (Synced with Register.jsx) ---
    const getPasswordStrength = (pwd) => {
        let s = 0;
        if (pwd.length >= 8) s++;
        if (/[A-Z]/.test(pwd)) s++;
        if (/[0-9]/.test(pwd)) s++;
        if (/[^A-Za-z0-9]/.test(pwd)) s++;
        return s;
    };

    const strength = getPasswordStrength(formData.password);
    const passwordsMatch = formData.password.length > 0 && formData.password === formData.password_confirm;
    const allFieldsFilled = formData.username && formData.email && formData.password && formData.password_confirm;

    // Synced with Register.jsx threshold (strength < 3)
    const isFormInvalid = !allFieldsFilled || strength < 3 || !passwordsMatch;

    const strengthLevels = [
        { label: "Weak", color: "bg-red-500" },
        { label: "Fair", color: "bg-orange-500" },
        { label: "Good", color: "bg-yellow-500" },
        { label: "Strong", color: "bg-emerald-500" },
    ];

    const requirements = [
        { label: "8+ Characters", met: formData.password.length >= 8 },
        { label: "Uppercase & Number", met: /[A-Z]/.test(formData.password) && /[0-9]/.test(formData.password) },
        { label: "Special Char", met: /[^A-Za-z0-9]/.test(formData.password) },
        { label: "Passwords Match", met: passwordsMatch },
    ];

    // Lock background scrolling
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isFormInvalid) return;

        setError("");
        setLoading(true);

        try {
            const res = await api.post(API_ENDPOINTS.CREATE_USER, formData);
            onSuccess(res.data.message);
            onClose();
        } catch (err) {
            const errData = err.response?.data;
            const firstErr = typeof errData === 'object' ? (errData.message || Object.values(errData)[0]) : "Failed to create user.";
            setError(Array.isArray(firstErr) ? firstErr[0] : firstErr);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-linear-to-r from-indigo-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400"><UserPlus className="w-5 h-5" /></div>
                        <h2 className="text-white font-bold">New User Account</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5" /> {error}
                        </div>
                    )}

                    {/* Identifiers */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Username</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                <input
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-sm focus:border-indigo-500/50 outline-none transition-all"
                                    placeholder="Username"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-white text-sm focus:border-indigo-500/50 outline-none transition-all"
                                    placeholder="Email"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Password Fields */}
                    <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Password</label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-indigo-500/50 outline-none transition-all pr-10"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Confirm Password</label>
                            <div className="relative">
                                <input
                                    required
                                    type={showPasswordConfirm ? "text" : "password"}
                                    value={formData.password_confirm}
                                    onChange={(e) => setFormData({ ...formData, password_confirm: e.target.value })}
                                    className={`w-full bg-white/5 border rounded-xl px-4 py-2 text-white text-sm outline-none transition-all pr-10 ${formData.password_confirm
                                            ? (passwordsMatch ? 'border-emerald-500/30 focus:border-emerald-500' : 'border-red-500/30 focus:border-red-500')
                                            : 'border-white/10 focus:border-indigo-500/50'
                                        }`}
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 transition-colors"
                                >
                                    {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Requirements & Strength (Synced with Register.jsx style) */}
                        {formData.password.length > 0 && (
                            <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div
                                            key={i}
                                            className={`h-full flex-1 transition-all duration-500 ${i <= strength ? strengthLevels[strength - 1]?.color : 'bg-white/5'}`}
                                        />
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/5 pt-3">
                                    {requirements.map((req, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <div className={`shrink-0 h-3.5 w-3.5 rounded-full flex items-center justify-center transition-colors ${req.met ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-gray-600'}`}>
                                                {req.met ? <Check className="w-2.5 h-2.5" /> : <Circle className="w-1 h-1 fill-current" />}
                                            </div>
                                            <span className={`text-[10px] font-medium transition-colors ${req.met ? 'text-gray-300' : 'text-gray-500'}`}>
                                                {req.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col gap-3 pt-4">
                        <button
                            type="submit"
                            disabled={loading || isFormInvalid}
                            className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg ${isFormInvalid || loading
                                    ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5"
                                    : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/20"
                                }`}
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : !allFieldsFilled ? (
                                "Fill all fields"
                            ) : strength < 3 ? (
                                "Password too weak"
                            ) : !passwordsMatch ? (
                                "Check passwords"
                            ) : (
                                "Create Account"
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-full py-2 text-gray-500 text-[10px] font-bold uppercase hover:text-white transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateUserModal;