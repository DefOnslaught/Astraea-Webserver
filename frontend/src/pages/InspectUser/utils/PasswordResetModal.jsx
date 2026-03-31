import { useState } from "react";
import { X, Shield, Eye, EyeOff, Loader2, Check } from "lucide-react";

const PasswordResetModal = ({ isOpen, onClose, onConfirm, username }) => {
    const [passwords, setPasswords] = useState({ new: "", confirm: "" });
    const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false });
    const [updating, setUpdating] = useState(false);
    const [error, setError] = useState("");

    if (!isOpen) return null;

    const getPasswordStrength = (pwd) => {
        let s = 0;
        if (pwd.length >= 8) s++;
        if (/[A-Z]/.test(pwd)) s++;
        if (/[0-9]/.test(pwd)) s++;
        if (/[^A-Za-z0-9]/.test(pwd)) s++;
        return s;
    };

    const strength = getPasswordStrength(passwords.new);
    const passwordsMatch = passwords.new.length > 0 && passwords.new === passwords.confirm;

    const requirements = [
        { label: "At least 8 characters", met: passwords.new.length >= 8 },
        { label: "Uppercase & Number", met: /[A-Z]/.test(passwords.new) && /[0-9]/.test(passwords.new) },
        { label: "Special character", met: /[^A-Za-z0-9]/.test(passwords.new) },
        { label: "Passwords match", met: passwordsMatch },
    ];

    const strengthLevels = [
        { label: "Weak", color: "bg-red-500", width: "w-1/4" },
        { label: "Fair", color: "bg-orange-500", width: "w-2/4" },
        { label: "Good", color: "bg-yellow-500", width: "w-3/4" },
        { label: "Strong", color: "bg-emerald-500", width: "w-full" },
    ];

    const isValid = strength >= 3 && passwordsMatch;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setUpdating(true);

        try {
            await onConfirm(passwords.new);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to reset password.");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-linear-to-r from-indigo-500/10 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold">Reset Password</h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">User: {username}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">

                    {error && (
                        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-in slide-in-from-top-2">
                            <AlertTriangle className="w-4 h-4" /> {error}
                        </div>
                    )}

                    {/* Password Fields */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPasswords.new ? "text" : "password"}
                                    value={passwords.new}
                                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500/50 outline-none transition-all pr-10 text-sm"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400"
                                >
                                    {showPasswords.new ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Confirm Password</label>
                            <div className="relative">
                                <input
                                    type={showPasswords.confirm ? "text" : "password"}
                                    value={passwords.confirm}
                                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                    className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white focus:outline-none transition-all pr-10 text-sm ${passwords.confirm ? (passwordsMatch ? 'border-emerald-500/30' : 'border-red-500/30') : 'border-white/10'
                                        }`}
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Requirements Grid */}
                    <div className="grid grid-cols-2 gap-2">
                        {requirements.map((req, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className={`h-4 w-4 rounded-full flex items-center justify-center ${req.met ? 'bg-emerald-500/20 text-emerald-500' : 'bg-white/5 text-gray-600'}`}>
                                    <Check className="w-2.5 h-2.5" />
                                </div>
                                <span className={`text-[10px] font-medium ${req.met ? 'text-gray-300' : 'text-gray-500'}`}>{req.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Strength Bar */}
                    {passwords.new && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-bold uppercase tracking-tighter">
                                <span className="text-gray-500">Complexity</span>
                                <span className={strengthLevels[strength - 1]?.color.replace('bg-', 'text-')}>
                                    {strengthLevels[strength - 1]?.label}
                                </span>
                            </div>
                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-500 ${strengthLevels[strength - 1]?.color} ${strengthLevels[strength - 1]?.width}`} />
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl bg-white/5 text-gray-400 text-xs font-bold uppercase hover:bg-white/10 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid || updating}
                            className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold uppercase hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                        >
                            {updating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm Reset"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordResetModal;