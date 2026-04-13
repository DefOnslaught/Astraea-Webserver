import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    ChevronLeft, Shield, Key, UserMinus,
    UserCheck, Mail, Calendar, Fingerprint, Loader2,
    AlertTriangle, X, Check, RefreshCw, User
} from "lucide-react";
import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";
import SuccessToast from "../../components/SuccessToast";
import getRelativeTime from "../../utils/getRelativeTime";
import formatLastLogin from "../Administration/utils/formatLastLogin";
import PasswordResetModal from "./utils/PasswordResetModal";
import useDocumentTitle from "../../utils/useDocumentTitle";
import AccessForbidden from "../ErrorPages/AccessForbidden";
import ErrorAlert from "./utils/ErrorAlert";

const UserInspection = () => {
    const { username } = useParams();
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updating, setUpdating] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [msg, setMsg] = useState("");
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [showStatusConfirm, setShowStatusConfirm] = useState(false);
    const [showForbidden, setShowForbidden] = useState(false);

    useDocumentTitle(`Inspecting ${username} | Astraea`);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const res = await api.get(`${API_ENDPOINTS.INSPECT_USER}${username}/`);
                if (res.status === 200) {
                    setUser(res.data);
                }
            } catch (err) {
                if (err.response?.status === 403) {
                    setShowForbidden(true);
                } else {
                    setError("Error loading user data")
                }
            } finally {
                setLoading(false);
            }
        };
        fetchUserData();
    }, [username]);

    const handleUpdate = async (payload) => {
        setUpdating(true);
        setError("");
        try {
            const res = await api.patch(`${API_ENDPOINTS.INSPECT_USER}${username}/`, payload);
            if (res.status === 200) {
                setUser(res.data);
                setMsg("User updated successfully");
                setShowSuccess(true);
                setShowStatusConfirm(false);
                return res.data;
            }
        } catch (err) {
            if (err.response?.status === 406) {
                const backendMsg = err.response?.data?.message || err.response?.data?.detail || "Action not allowed";
                setError(`Permission Error: ${backendMsg}`);
            } else {
                setError("Failed to update user preferences.");
            }
            // THROW the error so the Modal's try/catch can see it
            throw err;
        } finally {
            setUpdating(false);
        }
    };

    const wrapUpdate = async (payload) => {
        try {
            await handleUpdate(payload);
        } catch (err) {
            // No need to display this error, we handle it within handleUpdate
        }
    };

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (showForbidden) return <AccessForbidden isEmbedded={false} />
    if (!user) return <div className="text-white">User not found.</div>;

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            {showSuccess && <SuccessToast message={msg} onClose={() => setShowSuccess(false)} />}

            {/* Back Navigation */}
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6 group"
            >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Users
            </button>

            {error && <ErrorAlert message={error} onClose={() => setError("")} />}

            {/* Header Profile Card */}
            <div className="bg-gray-900/50 border border-white/5 rounded-3xl p-8 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-xl">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-3xl font-bold shadow-2xl">
                        <User className="w-15 h-15" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">{user.username}</h1>
                        <div className="flex flex-wrap gap-4 mt-2 text-gray-400 text-sm">
                            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {user.email}</span>
                            <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Joined {new Date(user.date_joined).toLocaleDateString()}</span>
                            <span className="flex items-center gap-1.5"><Fingerprint className="w-3.5 h-3.5" /> ID: {user.id}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {!user.is_active && <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold tracking-widest uppercase">Inactive</span>}
                    {user.is_staff && <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold tracking-widest uppercase">Staff Access</span>}
                    {user.is_superuser && <span className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold tracking-widest uppercase">Superuser</span>}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Settings */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Access & Permissions */}
                    <section className="bg-gray-900/50 border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Shield className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-lg font-semibold text-white">Permissions</h2>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div>
                                    <p className="text-white font-medium text-sm">Staff Status</p>
                                    <p className="text-xs text-gray-500">Allows access to, Configuration, Administration, and Django Admin login.</p>
                                </div>
                                <button
                                    onClick={() => wrapUpdate({ is_staff: !user.is_staff })}
                                    disabled={updating}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${user.is_staff ? 'bg-indigo-600' : 'bg-gray-700'} ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${user.is_staff ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Security Section */}
                    <section className="bg-gray-900/50 border border-white/5 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <Key className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-lg font-semibold text-white">Security</h2>
                        </div>
                        <div className="p-4 border border-indigo-500/20 bg-indigo-500/5 rounded-xl flex justify-between items-center">
                            <div>
                                <p className="text-white font-medium text-sm">Reset Password</p>
                                <p className="text-xs text-gray-400">Reset {username}'s password.</p>
                            </div>
                            <button
                                onClick={() => setIsResetModalOpen(true)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </section>
                </div>

                {/* Sidebar Info & Danger Zone */}
                <div className="space-y-8">
                    <section className="bg-gray-900/50 border border-white/5 rounded-2xl p-6">
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Account Activity</h3>
                        <div className="space-y-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Last Login</span>
                                <span className="text-gray-300 font-mono">{user.last_login ? formatLastLogin(user.last_login) : 'Never'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Account Created</span>
                                <span className="text-gray-300 font-mono">{new Date(user.date_joined).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </section>

                    {/* DANGER ZONE - Implementation of Confirmation Toggle */}
                    <section className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle className="text-red-500/50 w-4 h-4" />
                            <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">Danger Zone</h3>
                        </div>

                        {!showStatusConfirm ? (
                            <div className="space-y-4">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    {user.is_active
                                        ? "Deactivating will immediately revoke all access to Astraea services for this user."
                                        : "Reactivating will restore the user's ability to login to the platform."}
                                </p>
                                <button
                                    onClick={() => setShowStatusConfirm(true)}
                                    className={`w-full py-2.5 flex items-center justify-center gap-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border ${user.is_active
                                            ? 'border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white shadow-lg shadow-red-900/10'
                                            : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white shadow-lg shadow-emerald-900/10'
                                        }`}
                                >
                                    {user.is_active ? <UserMinus className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                    {user.is_active ? "Deactivate User" : "Reactivate User"}
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 border border-red-500/40 rounded-xl bg-red-900/20 animate-in zoom-in-95 duration-200">
                                <p className="text-[10px] font-bold text-red-400 text-center mb-4 uppercase tracking-tighter italic">
                                    Confirm Account {user.is_active ? 'Deactivation' : 'Reactivation'}?
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowStatusConfirm(false)}
                                        className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-[10px] font-bold uppercase hover:bg-white/10 transition-colors"
                                    >
                                        <X className="w-3 h-3 mx-auto" />
                                    </button>
                                    <button
                                        type="button"
                                            onClick={() => wrapUpdate({ is_active: !user.is_active })}
                                        disabled={updating}
                                        className={`flex-1 py-2 rounded-lg text-white text-[10px] font-bold uppercase shadow-lg transition-all ${user.is_active
                                                ? 'bg-red-600 hover:bg-red-500 shadow-red-900/40'
                                                : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/40'
                                            }`}
                                    >
                                        {updating ? (
                                            <RefreshCw className="w-3 h-3 animate-spin mx-auto" />
                                        ) : (
                                            <Check className="w-3 h-3 mx-auto" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
            <PasswordResetModal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                username={user.username}
                onConfirm={async (newPassword) => {
                    await wrapUpdate({ password: newPassword });
                    setIsResetModalOpen(false);
                }}
            />
        </div>
    );
};

export default UserInspection;