import { useState, useEffect } from "react";
import {
    Bell, Save, Plus, Mail, Trash2, Edit3,
    Settings, AlertTriangle, Loader2, X, Info, RefreshCw,
    ShieldCheck, CheckCircle2, AlertCircle
} from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";

const NotificationSettings = ({ triggerSuccess, setError }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [services, setServices] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedService, setSelectedService] = useState(null);
    const [serviceToDelete, setServiceToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Notification Logic Triggers
    const [notifyTriggers, setNotifyTriggers] = useState({
        failed: true,
        success: true,
        partial: false,
        outOfDate: true
    });

    // --- Data Fetching ---
    const fetchData = async () => {
        setIsLoading(true);
        try {

            const settingsRes = await api.get(API_ENDPOINTS.NOTIFY_SETTINGS);
            setNotifyTriggers({
                failed: settingsRes.data.failed,
                success: settingsRes.data.success,
                partial: settingsRes.data.partial,
                outOfDate: settingsRes.data.out_of_date,
            });

            const servicesRes = await api.get(API_ENDPOINTS.NOTIFY_SERVICES);

            if (Array.isArray(servicesRes.data)) {
                setServices(servicesRes.data);
            } else {
                setServices([]);
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
    const handleToggleService = async (service) => {
        try {
            const payload = {
                data: {
                    id: service.id,
                    active: !service.active
                }
            };
            await api.patch(API_ENDPOINTS.NOTIFY_SERVICES, payload);
            setServices(services.map(s => s.id === service.id ? { ...s, active: !s.active } : s));
            triggerSuccess("Service status updated.");
        } catch (err) {
            setError("Failed to update service status.");
        }
    };

    const handleDeleteService = async (id) => {
        setIsDeleting(true);
        try {
            const payload = { data: { id: id } };
            const res = await api.delete(API_ENDPOINTS.NOTIFY_SERVICES, { data: payload });

            if (res.status === 200) {
                setServices(services.filter(s => s.id !== id));
                triggerSuccess("Notification service removed.");
                setServiceToDelete(null);
            }
        } catch (err) {
            setError("Delete request failed.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSaveTriggers = async () => {
        setIsSaving(true);
        try {
            const payload = {
                data: {
                    failed: notifyTriggers.failed,
                    success: notifyTriggers.success,
                    partial: notifyTriggers.partial,
                    out_of_date: notifyTriggers.outOfDate,
                }
            };
            const res = await api.patch(API_ENDPOINTS.NOTIFY_SETTINGS, payload);
            if (res.status === 200) {
                triggerSuccess("Global trigger logic updated.");
            }
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

            {/* Services Management */}
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-[0.2em]">Active Channels</h3>
                        <p className="text-xs text-gray-600 mt-0.5">Where Astraea sends alerts</p>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedService(null);
                            setIsModalOpen(true);
                        }}
                        className="p-2 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-400 hover:text-white rounded-xl transition-all border border-indigo-500/20"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-3">
                    {services.map(service => (
                        <div key={service.id} className="relative overflow-hidden group">
                            {serviceToDelete === service.id ? (
                                // --- CONFIRM DELETE UI ---
                                <div className="flex items-center justify-between p-4 bg-red-900/20 border border-red-500/40 rounded-2xl animate-in zoom-in-95 duration-200">
                                    <div className="flex items-center gap-3">
                                        <AlertTriangle className="w-5 h-5 text-red-500" />
                                        <p className="text-xs font-bold text-red-400 italic">
                                            Remove "{service.name}"?
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setServiceToDelete(null)}
                                            className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-[10px] font-bold uppercase hover:bg-white/10 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => handleDeleteService(service.id)}
                                            disabled={isDeleting}
                                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase hover:bg-red-500 shadow-lg shadow-red-900/40 disabled:opacity-50"
                                        >
                                            {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Confirm"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // --- STANDARD ROW UI ---
                                    <div className="flex items-center justify-between p-4 bg-gray-900/80 border border-white/5 rounded-2xl hover:bg-gray-800/80 hover:border-indigo-500/30 transition-all group/row cursor-pointer"
                                        onClick={() => { setSelectedService(service); setIsModalOpen(true); }}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl transition-colors ${service.type === 'discord' ? 'bg-indigo-500/10 group-hover/row:bg-indigo-500/20' : 'bg-emerald-500/10 group-hover/row:bg-emerald-500/20'}`}>
                                                {service.type === 'discord' ? (
                                                    <i className="fa-brands fa-discord w-5 h-5 text-indigo-400" />
                                                ) : (
                                                    <Mail className="w-5 h-5 text-emerald-400" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-white tracking-tight">{service.name}</p>
                                                    {/* Visual Indicator for Edit */}
                                                    <Edit3 className="w-3 h-3 text-indigo-400 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                                                </div>
                                                <p className="text-[10px] text-gray-500 font-mono truncate max-w-xs opacity-60">
                                                    {service.type === 'smtp' ? service.recipients || 'Default Recipients' : service.url}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                            {/* Note: stopPropagation prevents the row click (edit) when clicking toggle/delete */}
                                            <button
                                                onClick={() => handleToggleService(service)}
                                                className={`text-[9px] font-black px-2.5 py-1 rounded-full border transition-all ${service.active ? 'border-emerald-500/40 text-emerald-500 bg-emerald-500/10' : 'border-gray-700 text-gray-500'}`}
                                            >
                                                {service.active ? 'LIVE' : 'OFF'}
                                            </button>
                                            <button
                                                onClick={() => setServiceToDelete(service.id)}
                                                className="p-2 text-gray-700 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Service Creation Modal */}
            {isModalOpen && (
                <AddServiceModal
                    service={selectedService}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={(updatedService) => {
                        if (selectedService) {
                            setServices(services.map(s => s.id === updatedService.id ? updatedService : s));
                        } else {
                            setServices([...services, updatedService]);
                        }
                        setIsModalOpen(false);
                    }}
                    setError={setError}
                />
            )}
        </div>
    );
};

// --- Modal Component ---
const AddServiceModal = ({ service, onClose, onSuccess, setError }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [formData, setFormData] = useState({
        name: service?.name || "",
        type: service?.type || "discord",
        discordWebhook: service?.url || "",
        recipients: service?.recipients || "",
        active: service ? service.active : true
    });

    useEffect(() => {
        setFormData({
            name: service?.name || "",
            type: service?.type || "discord",
            discordWebhook: service?.url || "",
            recipients: service?.recipients || "",
            active: service ? service.active : true
        });
    }, [service]);

    useEffect(() => { setTestResult(null); }, [formData]);

    const isEditing = !!service;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload = {
                data: {
                    ...formData,
                    id: service?.id
                }
            };

            let res;
            if (isEditing) {
                res = await api.patch(API_ENDPOINTS.NOTIFY_SERVICES, payload);
            } else {
                res = await api.post(API_ENDPOINTS.NOTIFY_SERVICES, payload);
            }
            onSuccess(res.data);
        } catch (err) {
            setError(isEditing ? "Failed to update service." : "Failed to connect service.");
        } finally {
            setIsSaving(false);
        }
    }

    const testService = async (e) => {
        e.preventDefault();
        setIsTesting(true);
        setTestResult(null);

        try {
            let res;
            const payload = {
                data: formData.type === 'discord'
                    ? { url: formData.discordWebhook, name: formData.name }
                    : { name: formData.name, recipients: formData.recipients }
            };

            const endpoint = formData.type === 'discord'
                ? API_ENDPOINTS.TEST_DISCORD
                : API_ENDPOINTS.TEST_EMAIL;

            res = await api.post(endpoint, payload);

            if (res.data === true) {
                setTestResult('success');
            } else {
                setTestResult('error');
            }
        } catch (err) {
            setTestResult('error');
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-500/5">
                    <h2 className="text-lg font-bold text-white uppercase tracking-tighter flex items-center gap-2">
                        <Settings className={`w-4 h-4 ${isEditing ? 'text-amber-400' : 'text-indigo-400'}`} />
                        {isEditing ? 'Modify Service' : 'Add Notification Channel'}
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
                                <i className="fa-brands fa-discord w-4 h-4 text-[1rem] inline-flex items-center justify-center translate-y-[0.5px]" /> Discord
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

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            // Disable if testing, if Discord URL is missing, OR if we already have a success
                            disabled={
                                isTesting ||
                                (formData.type === 'discord' && !formData.discordWebhook) ||
                                testResult === 'success'
                            }
                            onClick={testService}
                            className={`flex-1 py-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${testResult === 'success'
                                    ? 'border-emerald-500 text-emerald-500 bg-emerald-500/10 cursor-not-allowed' :
                                    testResult === 'error'
                                        ? 'border-red-500 text-red-500 bg-red-500/10 animate-shake' :
                                        'border-white/10 text-gray-400 hover:bg-white/5 active:scale-95'
                                }`}
                        >
                            {isTesting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : testResult === 'success' ? (
                                <CheckCircle2 className="w-3 h-3" />
                            ) : testResult === 'error' ? (
                                <AlertCircle className="w-3 h-3" />
                            ) : (
                                <ShieldCheck className="w-3 h-3" />
                            )}

                            {testResult === 'success'
                                ? 'Connection Verified'
                                : testResult === 'error'
                                    ? 'Connection Failed'
                                    : 'Test Connection'}
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className={`w-full py-4 rounded-xl text-sm font-bold mt-4 shadow-lg flex items-center justify-center gap-2 transition-all ${isEditing
                                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20'
                                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/20'
                            } text-white`}
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isEditing ? (
                            <>
                                <Save className="w-4 h-4" /> Update Service
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4" /> Connect Service
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NotificationSettings;