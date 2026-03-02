import { useState, useEffect } from "react";

import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";
import useDocumentTitle from '../../utils/useDocumentTitle';
import ErrorLoadingRequestedPage from "../ErrorPages/ErrorLoadingRequestedPage";
import SuccessToast from "../../components/SuccessToast";
import SectionLoader from "../../components/SectionLoader";
import { useAuth } from "../../utils/AuthContext";

const Profile = () => {
    useDocumentTitle('Profile | Astraea');

    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [failedToFetch, setFailedToFetch] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [activeTab, setActiveTab] = useState("general");
    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState("");
    const [passwords, setPasswords] = useState({ old: "", new: "", confirm: "" });
    const [isChangingPass, setIsChangingPass] = useState(false);
    const [showPasswords, setShowPasswords] = useState({ old: false, new: false, confirm: false });
    const { setUser } = useAuth();



    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await api.get(API_ENDPOINTS.PROFILE);
                setProfile(res.data);
                setNewUsername(res.data.username);
            } catch (err) {
                setFailedToFetch(true);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    useEffect(() => {
        setPasswords({ old: "", new: "", confirm: "" });
        setShowPasswords({ old: false, new: false, confirm: false });
        setError("");
    }, [activeTab]);

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const res = await api.put(API_ENDPOINTS.PROFILE, { username: newUsername });
            setProfile(res.data);

            setUser(prevUser => ({
                ...prevUser,
                username: res.data.username
            }));

            setIsEditing(false);
            setSuccessMsg("Username updated successfully!")
            setShowSuccess(true);
        } catch (err) {
            setError(err.response?.data?.username?.[0] || "Update failed.");
        }
    };

    const handlePasswordChange = async (event) => {
        event.preventDefault();
        setError("");
        if (passwords.new !== passwords.confirm ) {
            setError("New passwords do not match")
            return;
        }

        setIsChangingPass(true);
        try {
            await api.put (API_ENDPOINTS.CHANGE_PASSWORD, {
                old_password: passwords.old,
                new_password: passwords.new
            });
            setPasswords({ old: "", new: "", confirm: "" });
            setSuccessMsg("Password changed successfully!")
            setShowSuccess(true);
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to change password. Check your old password.");
        } finally {
            setIsChangingPass(false);
        }
    }

    const handleEditCancel = () => {
        setIsEditing(false);
        setError(false);
    }

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

    const strengthLevels = [
        { label: "Weak", color: "bg-red-500", width: "w-1/4" },
        { label: "Fair", color: "bg-orange-500", width: "w-2/4" },
        { label: "Good", color: "bg-yellow-500", width: "w-3/4" },
        { label: "Strong", color: "bg-emerald-500", width: "w-full" },
    ];

    const requirements = [
        { label: "At least 8 characters", met: passwords.new.length >= 8 },
        { label: "Contains an uppercase letter", met: /[A-Z]/.test(passwords.new) },
        { label: "Contains a number", met: /[0-9]/.test(passwords.new) },
        { label: "Contains a special character", met: /[^A-Za-z0-9]/.test(passwords.new) },
        { label: "Passwords match", met: passwords.confirm.length > 0 && passwordsMatch },
    ];

    const isNewPasswordValid = passwords.new.length > 0 && strength >= 3 && passwordsMatch;
    const isSubmitDisabled = isChangingPass || !passwords.old || !isNewPasswordValid;

    if (failedToFetch) return <ErrorLoadingRequestedPage />

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto">
                <div className="mb-8 opacity-50">
                    <h1 className="text-3xl font-bold text-white tracking-tight">Account Settings</h1>
                    <p className="text-gray-400 mt-2">Manage your profile information and security.</p>
                </div>
                <SectionLoader label="Fetching Profile..." />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {showSuccess && <SuccessToast message={successMsg} onClose={() => setShowSuccess(false)} />}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Account Settings</h1>
                <p className="text-gray-400 mt-2">Manage your profile information and security.</p>
            </div>

            {/* TAB NAVIGATION */}
            <div className="flex gap-8 border-b border-white/5 mb-8">
                {["general", "security"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => { setActiveTab(tab); setError(""); }}
                        className={`pb-4 text-sm font-medium capitalize transition-all relative ${activeTab === tab ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"
                            }`}
                    >
                        {tab}
                        {activeTab === tab && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 animate-in fade-in zoom-in duration-300" />
                        )}
                    </button>
                ))}
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm animate-in shake duration-300">
                    {error}
                </div>
            )}

            {activeTab === "general" ? (
                /* --- GENERAL TAB --- */
                <div className="bg-gray-800/50 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-8 border-b border-white/5 bg-gradient-to-r from-indigo-500/10 to-transparent flex items-center gap-6">
                        <div className="h-20 w-20 rounded-full bg-indigo-500 flex items-center justify-center text-3xl font-bold text-white shadow-indigo-500/20 shadow-lg">
                            {profile?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-white">{profile?.username}</h2>
                            <p className="text-gray-400 text-sm">{profile?.email}</p>
                        </div>
                    </div>
                    <div className="p-8 space-y-8">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="max-w-xs">
                                <label className="block text-sm font-medium text-gray-300">Username</label>
                                <p className="text-xs text-gray-500 mt-1">Visible to other users on the platform.</p>
                            </div>
                            {isEditing ? (
                                <form onSubmit={handleUpdate} className="flex gap-2 w-full md:w-auto">
                                    <input
                                        type="text"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        className="bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:border-indigo-500 outline-none transition-all w-full md:w-64"
                                        autoFocus
                                    />
                                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Save</button>
                                    <button type="button" onClick={handleEditCancel} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">Cancel</button>
                                </form>
                            ) : (
                                <button onClick={() => setIsEditing(true)} className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Change Username</button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* --- SECURITY TAB --- */
                    <div className="bg-gray-800/50 border border-white/5 rounded-2xl p-8 shadow-xl animate-in fade-in duration-300 flex flex-col items-center">
                        <div className="mb-8 text-center">
                            <h2 className="text-xl font-semibold text-white">Security Settings</h2>
                            <p className="text-gray-500 text-sm mt-1">Update your password to keep your account secure.</p>
                        </div>

                        <form onSubmit={handlePasswordChange} className="w-full max-w-md space-y-5">
                            {/* Current Password */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Current Password</label>
                                <div className="relative flex items-center">
                                    <input
                                        type={showPasswords.old ? "text" : "password"}
                                        value={passwords.old}
                                        onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                                        className="w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none transition-all pr-10"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswords({ ...showPasswords, old: !showPasswords.old })}
                                        className="absolute right-3 text-gray-500 hover:text-white transition-colors"
                                    >
                                        <i className={`fa-solid ${showPasswords.old ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                    </button>
                                </div>
                            </div>

                            <div className="border-t border-white/5 pt-5">
                                {/* New Password */}
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">New Password</label>
                                    <div className="relative flex items-center">
                                        <input
                                            type={showPasswords.new ? "text" : "password"}
                                            value={passwords.new}
                                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                            className="w-full bg-gray-900 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-indigo-500 outline-none transition-all pr-10"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                            className="absolute right-3 text-gray-500 hover:text-white transition-colors"
                                        >
                                            <i className={`fa-solid ${showPasswords.new ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        </button>
                                    </div>

                                    {/* Strength Bar */}
                                    {passwords.new.length > 0 && (
                                        <div className="mt-3 animate-in fade-in slide-in-from-top-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                                                    Strength: {strengthLevels[strength - 1]?.label}
                                                </span>
                                            </div>
                                            <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-500 ${strengthLevels[strength - 1]?.color} ${strengthLevels[strength - 1]?.width}`}></div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div className="mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Confirm New Password</label>
                                        {passwords.confirm.length > 0 && (
                                            <span className={`text-[10px] font-bold uppercase tracking-widest ${passwordsMatch ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {passwordsMatch ? 'Match' : 'No Match'}
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative flex items-center">
                                        <input
                                            type={showPasswords.confirm ? "text" : "password"}
                                            value={passwords.confirm}
                                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                            className={`w-full bg-gray-900 border rounded-lg px-4 py-2 text-white focus:outline-none transition-all pr-10
                                            ${passwords.confirm.length > 0
                                                    ? (passwordsMatch ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-red-500/50 focus:border-red-500')
                                                    : 'border-white/10 focus:border-indigo-500'}`}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                            className="absolute right-3 text-gray-500 hover:text-white transition-colors"
                                        >
                                            <i className={`fa-solid ${showPasswords.confirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Checklist */}
                            {passwords.new.length > 0 && (
                                <div className="py-4 grid grid-cols-1 gap-2 border-t border-white/5 mt-2">
                                    {requirements.map((req, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <i className={`fa-solid ${req.met ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-gray-700'} text-[12px]`}></i>
                                            <span className={`text-[11px] ${req.met ? 'text-gray-300' : 'text-gray-600'}`}>
                                                {req.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitDisabled}
                                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-lg
                                ${isSubmitDisabled
                                        ? "bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5 shadow-none"
                                        : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
                                    }`}
                            >
                                {isChangingPass ? "Updating Security..." : "Update Password"}
                            </button>
                        </form>
                    </div>
            )}
        </div>
    );
}

export default Profile;