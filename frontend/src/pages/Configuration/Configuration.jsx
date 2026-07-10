import { useState, useRef, useEffect } from "react";
import {
    Settings, Bell, Key, Cpu, MonitorCog
} from "lucide-react";
import { useAuth } from "../../utils/AuthContext";
import useDocumentTitle from "../../utils/useDocumentTitle";
import SuccessToast from "../../components/SuccessToast";
import GeneralSettings from "./utils/GeneralSettings";
import ApiKeySettings from "./utils/ApiKeySettings";
import AgentSettings from "./utils/AgentSettings";
import NotificationSettings from "./utils/NotificationSettings";
import ZabbixSettings from "./utils/ZabbixSettings";
import AccessForbidden from "../ErrorPages/AccessForbidden";
import ErrorToast from "../../components/ErrorToast";

const Configuration = () => {
    useDocumentTitle('Configuration | Astraea');

    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState(() => {
        const hash = window.location.hash.replace("#", "");
        return ["general", "notifications", "api", "agent", "zabbix"].includes(hash) ? hash : "general";
    });
    const [successMsg, setSuccessMsg] = useState("");
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState("");
    const successTimeoutRef = useRef(null);

    const triggerSuccess = (msg) => {
        if (successTimeoutRef.current) {
            clearTimeout(successTimeoutRef.current);
        }

        setSuccessMsg(msg);
        setShowSuccess(true);
        setError("");

        successTimeoutRef.current = setTimeout(() => {
            setShowSuccess(false);
        }, 3000);
    };

    const showError = (msg) => {
        setShowSuccess(false);
        setError(msg);
    };

    useEffect(() => {
        if (activeTab === "general") {
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
                setActiveTab("general");
            }
        };

        window.addEventListener("hashchange", handleHashChange);
        return () => window.removeEventListener("hashchange", handleHashChange);
    }, [activeTab]);

    const tabs = [
        { id: 'general', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
        { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
        { id: 'api', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
        { id: 'agent', label: 'Astraea Agent', icon: <Cpu className="w-4 h-4" /> },
        { id: 'zabbix', label: 'Zabbix Settings', icon: <MonitorCog className="w-4 h-4" /> },
    ];

    const hasAdminAccess = user?.is_staff || user?.is_superuser;
    if (!hasAdminAccess) return <AccessForbidden isEmbedded={false} />

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">

            {showSuccess && <SuccessToast message={successMsg} onClose={() => setShowSuccess(false)} />}
            {error && <ErrorToast message={error} onClose={() => setError("")} />}

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Configuration</h1>
                <p className="text-gray-400 mt-2">Manage system-wide settings, API access, and agent deployment.</p>
            </div>

            <div className="flex gap-8 border-b border-white/5 mb-8">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setError(""); }}
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

            {/* TAB CONTENT AREAS */}
            <div className="mt-4">
                {activeTab === "general" && <GeneralSettings triggerSuccess={triggerSuccess} setError={showError} />}
                {activeTab === "api" && <ApiKeySettings triggerSuccess={triggerSuccess} setError={showError} />}
                {activeTab === "notifications" && <NotificationSettings triggerSuccess={triggerSuccess} setError={showError} />}
                {activeTab === "agent" && <AgentSettings triggerSuccess={triggerSuccess} setError={showError} />}
                {activeTab === "zabbix" && <ZabbixSettings triggerSuccess={triggerSuccess} setError={showError} />}
            </div>
        </div>
    );
};

export default Configuration;