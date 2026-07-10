import { useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faShieldHalved,
    faCheck,
    faMinus,
    faEyeSlash,
    faEye,
    faCircleNotch,
    faBolt
} from "@fortawesome/free-solid-svg-icons";
import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";
import useDocumentTitle from '../../utils/useDocumentTitle';
import ErrorLoadingRequestedPage from "../ErrorPages/ErrorLoadingRequestedPage";
import SuccessToast from "../../components/SuccessToast";
import SectionLoader from "../../components/SectionLoader";
import { useAuth } from "../../utils/AuthContext";
import LogoutModal from "../../components/LogoutModal";
import ErrorToast from "../../components/ErrorToast";

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
    const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
    const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
    const { setUser } = useAuth();
    const navigate = useNavigate();



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

    const handleLogoutAll = async () => {
        setIsLoggingOutAll(true);
        try {
            await api.post(API_ENDPOINTS.LOGOUT_ALL_DEVICES);
            setUser(null);
            navigate("/logout");
        } catch (err) {
            setError("Failed to log out of all devices. Please try again.");
            setShowLogoutAllModal(false);
        } finally {
            setIsLoggingOutAll(false);
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

            {error && <ErrorToast message={error} onClose={() => setError("")} />}

            {activeTab === "general" ? (
                /* --- GENERAL TAB --- */
                <div className="bg-gray-800/50 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                    <div className="p-8 border-b border-white/5 bg-linear-to-r from-indigo-500/10 to-transparent flex items-center gap-6">
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
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-400">
    
                    {/* Password Section */}
                    <div className="bg-gray-800/50 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-white/5 bg-linear-to-r from-indigo-500/5 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-indigo-500/10">
                                    <FontAwesomeIcon icon={faShieldHalved} className="text-indigo-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-white">Security Credentials</h2>
                                    <p className="text-xs text-gray-500">Keep your account protected with a strong password.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-12">
                            {/* Left Column: Requirements & Status */}
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Password Requirements</h4>
                                    <div className="space-y-3">
                                        {requirements.map((req, index) => (
                                            <div key={index} className="flex items-center gap-3">
                                                <div className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${req.met ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
                                                    <FontAwesomeIcon
                                                        icon={req.met ? faCheck : faMinus}
                                                        className={`${req.met ? 'text-emerald-500' : 'text-gray-600'} text-[10px]`}
                                                    />
                                                </div>
                                                <span className={`text-sm transition-colors ${req.met ? 'text-gray-300' : 'text-gray-500'}`}>
                                                    {req.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {passwords.new.length > 0 && (
                                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 animate-in zoom-in duration-300">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Account Security Score</span>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${strengthLevels[strength - 1]?.color} text-white`}>
                                                {strengthLevels[strength - 1]?.label}
                                            </span>
                                        </div>
                                        <div className="h-1.5 w-full bg-gray-900 rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-700 ${strengthLevels[strength - 1]?.color} ${strengthLevels[strength - 1]?.width}`}></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column: The Form */}
                            <form onSubmit={handlePasswordChange} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Current Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.old ? "text" : "password"}
                                            value={passwords.old}
                                            onChange={(e) => setPasswords({ ...passwords, old: e.target.value })}
                                            className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500/50 outline-none transition-all pr-10"
                                            placeholder="••••••••"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords({ ...showPasswords, old: !showPasswords.old })}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 transition-colors"
                                        >
                                            <FontAwesomeIcon icon={showPasswords.old ? faEyeSlash : faEye} />
                                        </button>
                                    </div>
                                </div>

                                <div className="h-px bg-white/5 my-2" />

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.new ? "text" : "password"}
                                            value={passwords.new}
                                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                                            className="w-full bg-gray-900/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-indigo-500/50 outline-none transition-all pr-10"
                                            placeholder="Min. 8 characters"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 transition-colors"
                                        >
                                            <FontAwesomeIcon icon={showPasswords.new ? faEyeSlash : faEye} />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider ml-1">Confirm New Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPasswords.confirm ? "text" : "password"}
                                            value={passwords.confirm}
                                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                                            className={`w-full bg-gray-900/50 border rounded-xl px-4 py-2.5 text-white focus:outline-none transition-all pr-10 
                                                ${passwords.confirm.length > 0 ? (passwordsMatch ? 'border-emerald-500/30 focus:border-emerald-500/50' : 'border-red-500/30 focus:border-red-500/50') : 'border-white/10 focus:border-indigo-500/50'}`}
                                            placeholder="Repeat new password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 transition-colors"
                                        >
                                            <FontAwesomeIcon icon={showPasswords.confirm ? faEyeSlash : faEye} />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitDisabled}
                                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all duration-300 mt-2
                                        ${isSubmitDisabled
                                            ? "bg-gray-800 text-gray-600 cursor-not-allowed opacity-50"
                                            : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-[0.98]"
                                        }`}
                                >
                                    {isChangingPass ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <FontAwesomeIcon icon={faCircleNotch} className="animate-spin" /> Processing...
                                        </span>
                                    ) : "Update Password"}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Danger Zone: Sessions */}
                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 shrink-0">
                                    <FontAwesomeIcon icon={faBolt} className="text-xl" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Active Sessions</h3>
                                    <p className="text-sm text-gray-400 max-w-md">
                                        Notice something unusual? Sign out of all active devices. 
                                        <span className="text-red-400/80 font-medium ml-1 italic">This will also end your current session.</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowLogoutAllModal(true)}
                                className="w-full md:w-auto px-6 py-3 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 rounded-xl text-sm font-bold border border-red-500/20 transition-all duration-300"
                            >
                                Log out of all devices
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <LogoutModal
                isOpen={showLogoutAllModal}
                title="Sign out of all devices?"
                description="This will immediately invalidate all active sessions. You will be logged out of this device and any others where you are currently signed in."
                confirmLabel={isLoggingOutAll ? "Processing..." : "Sign Out Everywhere"}
                onCancel={() => setShowLogoutAllModal(false)}
                onConfirm={handleLogoutAll}
            />
        </div>
    );
}

export default Profile;