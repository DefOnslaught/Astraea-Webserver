import { useState, useEffect } from "react";
import {
    Bell, Save, Plus, Mail, Hash, Trash2,
    Settings, AlertCircle, Loader2, X, Info
} from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";

const NotificationSettings = ({ triggerSuccess, setError }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [services, setServices] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Notification Logic Triggers
    const [notifyTriggers, setNotifyTriggers] = useState({
        failed: true,
        success: true,
        partial: false,
        outOfDate: true
    });

    // --- Data Fetching with Failsafes ---
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [servicesRes, settingsRes] = await Promise.all([
                api.get(API_ENDPOINTS.NOTIFY_SERVICES).catch(() => ({ data: [] })),
                api.get(API_ENDPOINTS.NOTIFY_SETTINGS).catch(() => ({ data: null }))
            ]);

            // Strict Array Check: Handle 404 HTML or unexpected objects
            if (Array.isArray(servicesRes.data)) {
                setServices(servicesRes.data);
            } else {
                setServices([]); // Force empty array if backend sends junk
            }

            // Object Check for settings
            if (settingsRes.data && typeof settingsRes.data === 'object' && !Array.isArray(settingsRes.data)) {
                setNotifyTriggers(prev => ({ ...prev, ...settingsRes.data }));
            }
        } catch (err) {
            setError("Communication error with notification engine.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- Handlers ---
    const handleToggleService = async (id, currentStatus) => {
        try {
            await api.patch(`${API_ENDPOINTS.NOTIFY_SERVICES}${id}/`, { active: !currentStatus });
            setServices(services.map(s => s.id === id ? { ...s, active: !s.active } : s));
            triggerSuccess("Service status updated.");
        } catch (err) {
            setError("Failed to update service status.");
        }
    };

    const handleDeleteService = async (id) => {
        try {
            await api.delete(`${API_ENDPOINTS.NOTIFY_SERVICES}${id}/`);
            setServices(services.filter(s => s.id !== id));
            triggerSuccess("Notification service removed.");
        } catch (err) {
            setError("Delete request failed.");
        }
    };

    const handleSaveTriggers = async () => {
        setIsSaving(true);
        try {
            await api.post(API_ENDPOINTS.NOTIFY_SETTINGS, notifyTriggers);
            triggerSuccess("Global trigger logic updated.");
        } catch (err) {
            setError("Failed to save triggers.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-in fade-in slide-in-from-bottom-2">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Loading Notification Engine...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 1. Triggers Section */}
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Bell className="w-5 h-5 text-indigo-400" /> Event Triggers
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">Determine which system events fire a notification.</p>
                    </div>
                    <button
                        onClick={handleSaveTriggers}
                        disabled={isSaving}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Logic
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(notifyTriggers).map(([key, val]) => (
                        <div key={key} className="flex flex-col p-4 bg-gray-900/50 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                    {key.replace(/([A-Z])/g, ' $1')}
                                </span>
                                <button
                                    onClick={() => setNotifyTriggers({ ...notifyTriggers, [key]: !val })}
                                    className={`w-10 h-5 rounded-full transition-colors relative ${val ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.4)]' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${val ? 'left-5.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                            <p className="text-xs text-gray-300">
                                {key === 'failed' && "Notify on patching failure."}
                                {key === 'success' && "Notify on successful patch."}
                                {key === 'partial' && "Notify on partial patch."}
                                {key === 'outOfDate' && "Notify when a system is outdated."}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* 2. Services Management */}
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Active Channels</h3>
                        <p className="text-xs text-gray-600 mt-0.5">Where Astraea sends alerts</p>
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="p-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3">
                    {services.length > 0 ? (
                        services.map(service => (
                            <div key={service.id} className="group flex items-center justify-between p-4 bg-gray-900/80 border border-white/5 rounded-2xl hover:bg-gray-900 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${service.type === 'discord' ? 'bg-indigo-500/10' : 'bg-emerald-500/10'}`}>
                                        {service.type === 'discord' ? <Hash className="w-5 h-5 text-indigo-400" /> : <Mail className="w-5 h-5 text-emerald-400" />}
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white tracking-tight">{service.name}</p>
                                        <p className="text-[10px] text-gray-500 font-mono truncate max-w-50 md:max-w-xs opacity-60">
                                            {service.type === 'smtp' ? `To: ${service.recipients || 'Registered Users'}` : service.url}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleToggleService(service.id, service.active)}
                                        className={`text-[9px] font-black px-2.5 py-1 rounded-full border transition-all ${service.active
                                                ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10'
                                                : 'border-gray-700 text-gray-500 bg-gray-800/50'
                                            }`}
                                    >
                                        {service.active ? 'LIVE' : 'OFF'}
                                    </button>
                                    <button
                                        onClick={() => handleDeleteService(service.id)}
                                        className="p-2 text-gray-700 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-white/5 rounded-2xl bg-gray-900/20 grayscale">
                            <AlertCircle className="w-8 h-8 text-gray-700 mb-2" />
                            <p className="text-xs text-gray-600 font-bold uppercase tracking-widest">No Services Configured</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Service Creation Modal */}
            {isModalOpen && (
                <AddServiceModal
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={(newService) => {
                        setServices([...services, newService]);
                        setIsModalOpen(false);
                        triggerSuccess("New channel connected.");
                    }}
                    setError={setError}
                />
            )}
        </div>
    );
};

// --- Modal Component ---
const AddServiceModal = ({ onClose, onSuccess, setError }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        type: "discord",
        discordWebhook: "", // For Discord Webhook
        recipients: "" // For SMTP Additional
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await api.post(API_ENDPOINTS.NOTIFY_SERVICES, formData);
            onSuccess(res.data);
        } catch (err) {
            setError("Failed to create service.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-500/5">
                    <h2 className="text-lg font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                        <Settings className="w-4 h-4 text-indigo-400" /> Add Notification Channel
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Friendly Name</label>
                        <input
                            required
                            type="text"
                            placeholder="e.g. Discord Alerts"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Service Type</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: 'discord' })}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${formData.type === 'discord' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400' : 'bg-gray-800 border-white/5 text-gray-500'}`}
                            >
                                <Hash className="w-4 h-4" /> Discord
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, type: 'smtp' })}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${formData.type === 'smtp' ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' : 'bg-gray-800 border-white/5 text-gray-500'}`}
                            >
                                <Mail className="w-4 h-4" /> SMTP Email
                            </button>
                        </div>
                    </div>

                    {formData.type === 'discord' ? (
                        <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Webhook URL</label>
                            <input
                                required
                                type="url"
                                placeholder="https://discord.com/api/webhooks/..."
                                value={formData.discordWebhook}
                                onChange={(e) => setFormData({ ...formData, discordWebhook: e.target.value })}
                                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm font-mono focus:border-indigo-500 outline-none"
                            />
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex gap-3">
                                <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                <p className="text-[11px] text-gray-400 leading-normal">
                                    By default, emails go to all registered users. Use the field below for aliases or non-system users. Ensure the `.env` is configured.
                                </p>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Additional Recipients</label>
                                <input
                                    type="text"
                                    placeholder="it-team@company.lan, ops@alias.com"
                                    value={formData.recipients}
                                    onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
                                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-emerald-500 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl text-sm font-bold mt-4 shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect Channel"}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NotificationSettings;