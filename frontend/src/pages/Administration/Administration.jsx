import { useState} from "react";
import { Users, ShieldCheck, ExternalLink } from "lucide-react";
import { useAuth } from "../../utils/AuthContext";
import useDocumentTitle from "../../utils/useDocumentTitle";
import UserManagement from "./utils/UserManagement";
import SuccessToast from "../../components/SuccessToast";
import AccessForbidden from "../ErrorPages/AccessForbidden";

const Administration = () => {
    useDocumentTitle('Administration | Astraea');

    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState("users");
    const [successMsg, setSuccessMsg] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);

    const hasAdminAccess = user?.is_staff || user?.is_superuser;

    const tabs = [
        { id: 'users', label: 'User Accounts', icon: <Users className="w-4 h-4" /> },
        { id: 'permissions', label: 'System Access', icon: <ShieldCheck className="w-4 h-4" /> },
    ];

    const handleGlobalSuccess = (message) => {
        setSuccessMsg(message);
        setShowSuccess(true);
    };

    if (!hasAdminAccess) return <AccessForbidden isEmbedded={false} />

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

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
                        className={`pb-4 text-sm font-medium transition-all relative flex items-center gap-2 ${activeTab === tab.id ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"
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

            {/* Content Area */}
            <div className="mt-4">
                {activeTab === "users" && <UserManagement onNotify={handleGlobalSuccess} />}
                
                {/* TODO Figure out what else to add here  */}
                {activeTab === "permissions" && (
                    <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-8 text-center">
                        <ShieldCheck className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-white">Advanced Permissions</h3>
                        <p className="text-gray-500 max-w-md mx-auto mt-2">
                            Work in progress, more to come in later versions
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Administration;