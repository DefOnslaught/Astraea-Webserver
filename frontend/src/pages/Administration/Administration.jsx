import { useState, useEffect, useRef } from "react";
import { Users, ShieldCheck, ExternalLink, Database } from "lucide-react";
import { useAuth } from "../../utils/AuthContext";
import useDocumentTitle from "../../utils/useDocumentTitle";
import UserManagement from "./utils/UserManagement";
import SuccessToast from "../../components/SuccessToast";
import AccessForbidden from "../ErrorPages/AccessForbidden";
import ServerMaintenance from "./utils/ServerMaintenance";

const Administration = () => {
    useDocumentTitle('Administration | Astraea');

    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(() => {
        const hash = window.location.hash.replace("#", "");
        return ["users", "maintenance"].includes(hash) ? hash : "users";
    });
    const [successMsg, setSuccessMsg] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const successTimeoutRef = useRef(null);
    const [error, setError] = useState("");

    const hasAdminAccess = user?.is_staff || user?.is_superuser;

    const triggerSuccess = (msg) => {
        if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
        }

        setSuccessMsg(msg);
        setShowSuccess(true);
        setError("");

        successTimeoutRef.current = setTimeout(() => {
            setShowSuccess(false);
        }, 1500);
    };

    const showError = (msg) => {
        setShowSuccess(false);
        setError(msg);
        setTimeout(() => setError(""), 3000);
    };

    useEffect(() => {
        if (activeTab === "users") {
            window.history.replaceState(null, null, window.location.pathname);
        } else {
            window.location.hash = activeTab;
        }
    }, [activeTab]);

    useEffect(() => {
        const handleHashChange = () => {
            const hash = window.location.hash.replace("#", "");
            if (hash && hash !== activeTab) {
                setActiveTab(hash);
            } else if (!hash) {
                setActiveTab("users");
            }
        };

        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, [activeTab]);

    const tabs = [
        { id: 'users', label: 'User Accounts', icon: <Users className="w-4 h-4" /> },
        { id: 'maintenance', label: 'Server Maintenance', icon: <Database className="w-4 h-4" /> },
    ];

    const handleGlobalSuccess = (message) => {
        setSuccessMsg(message);
        setShowSuccess(true);
    };

    if (!hasAdminAccess) return <AccessForbidden isEmbedded={false} />

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {showSuccess && <SuccessToast message={successMsg} onClose={() => setShowSuccess(false)} />}

            {/* Header Area */}
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Administration</h1>
                    <p className="text-gray-400 mt-2">Manage user identity, access levels, and core system overrides.</p>
                </div>

                {/* External Django Admin Link */}
                {user?.is_superuser && (
                    <a
                        href="/admin/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
                    >
                        Django Admin <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>

            {/* Horizontal Tab Bar */}
            <div className="flex gap-8 border-b border-white/5 mb-8">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`pb-4 text-sm font-medium capitalize transition-all relative flex items-center gap-2 ${activeTab === tab.id ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                        {activeTab === tab.id && (
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

            {/* Content Area */}
            <div className="mt-4">
                {activeTab === "users" && <UserManagement onNotify={handleGlobalSuccess} />}
                {activeTab === "maintenance" && <ServerMaintenance triggerSuccess={triggerSuccess} setError={showError} />}
            </div>
        </div>
    );
};

export default Administration;