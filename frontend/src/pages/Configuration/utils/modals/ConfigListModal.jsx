import { useState, useEffect, Fragment } from "react";
import {
    X, Trash2, Copy, Loader2, Database,
    AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
    Settings, Calendar, ShieldAlert, Key
} from "lucide-react";
import api from "../../../../utils/api";
import { API_ENDPOINTS } from "../../../../utils/constants";

const ConfigListModal = ({ onClose }) => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Track which configuration's full details are expanded
    const [expandedUid, setExpandedUid] = useState(null);

    // Inline state for modal-specific feedback
    const [localStatus, setLocalStatus] = useState({ type: null, msg: "" });
    const [deleteConfirmUid, setDeleteConfirmUid] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const showStatus = (type, msg) => {
        setLocalStatus({ type, msg });
        setTimeout(() => setLocalStatus({ type: null, msg: "" }), 3000);
    };

    const fetchConfigs = async () => {
        try {
            const res = await api.get(API_ENDPOINTS.AGENT_INSTALL_CONFIGS);
            setConfigs(res.data);
        } catch (err) {
            showStatus("error", "Failed to fetch configurations.");
        } finally {
            setLoading(false);
        }
    };

    // Lock background scrolling
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    useEffect(() => { fetchConfigs(); }, []);

    const handleDelete = async (uid) => {
        setIsDeleting(true);
        try {
            await api.delete(API_ENDPOINTS.DELETE_AGENT_INSTALL_CONFIG, { data: { uid } });
            showStatus("success", "Configuration deleted.");
            setConfigs(configs.filter(c => c.uid !== uid));
            if (expandedUid === uid) setExpandedUid(null);
            setDeleteConfirmUid(null);
        } catch (err) {
            showStatus("error", "Delete failed.");
        } finally {
            setIsDeleting(false);
        }
    };

    const copyToClipboard = async (cfg) => {
        let baseUrl = window.location.origin;
        if (
            cfg.base_url &&
            String(cfg.base_url).toLowerCase() !== "none" &&
            String(cfg.base_url).toLowerCase() !== "null" &&
            String(cfg.base_url).trim() !== ""
        ) {
            baseUrl = String(cfg.base_url).replace(/\/$/, "");
        }

        const url = `${baseUrl}/api/config/install_script/${cfg.uid}/`;
        const text = `curl -sSL ${url} | sudo bash`;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                showStatus("success", "Command copied!");
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) showStatus("success", "Command copied!");
            }
        } catch (err) {
            showStatus("error", "Failed to copy.");
        }
    };

    const toggleExpand = (uid) => {
        setExpandedUid(expandedUid === uid ? null : uid);
    };

    const formatBaseUrl = (url) => {
        if (!url || String(url).toLowerCase() === 'none' || String(url).toLowerCase() === 'null') {
            return "Auto-Detect";
        }
        return url;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gray-900/50">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Database className="w-5 h-5 text-indigo-400" /> Deployment History
                            </h2>
                            <p className="text-sm text-gray-500">Manage configurations and inspect detailed parameters.</p>
                        </div>

                        {/* Local Status Bar */}
                        {localStatus.msg && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium animate-in slide-in-from-left-2 duration-300 ${localStatus.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/10 border-red-500/20 text-red-400'
                                }`}>
                                {localStatus.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                {localStatus.msg}
                            </div>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                            <p className="text-gray-500 text-sm">Loading history...</p>
                        </div>
                    ) : configs.length === 0 ? (
                        <div className="text-center py-20 text-gray-500 italic">No configurations found.</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="overflow-x-auto pb-4 custom-scrollbar">
                                <table className="w-full text-left text-sm min-w-200 table-fixed">
                                    <thead>
                                        <tr className="text-gray-500 border-b border-white/5 uppercase text-[10px] font-bold tracking-wider">
                                            <th className="pb-3 px-2 w-10"></th>
                                            <th className="pb-3 px-2">Label / ID</th>
                                            <th className="pb-3 px-2 w-32">Environment</th>
                                            <th className="pb-3 px-2 w-40">Execution Logic</th>
                                            <th className="pb-3 px-2 text-right sticky right-0 bg-gray-900 w-24">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {configs.map((cfg) => {
                                            const isExpanded = expandedUid === cfg.uid;
                                            const isConfirmingDelete = deleteConfirmUid === cfg.uid;

                                            // Pre-calculate base URL display state
                                            const displayBaseUrl = formatBaseUrl(cfg.base_url);
                                            const isAutoDetect = displayBaseUrl === "Auto-Detect";

                                            return (
                                                <Fragment key={cfg.uid}>
                                                    {/* Row Entry */}
                                                    <tr className={`group transition-colors ${isConfirmingDelete ? 'bg-red-950/20' : 'hover:bg-white/2'} ${isExpanded ? 'bg-white/1' : ''}`}>
                                                        {!isConfirmingDelete ? (
                                                            <>
                                                                {/* STANDARD RECORD LOOK */}
                                                                <td className="py-4 px-2">
                                                                    <button
                                                                        onClick={() => toggleExpand(cfg.uid)}
                                                                        className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                                                        title={isExpanded ? "Hide Details" : "Show All Configuration details"}
                                                                    >
                                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                    </button>
                                                                </td>
                                                                <td className="py-4 px-2 cursor-pointer" onClick={() => toggleExpand(cfg.uid)}>
                                                                    <div className="text-indigo-300 font-medium hover:text-indigo-200 transition-colors truncate">{cfg.label || "Unnamed Config"}</div>
                                                                    <div className="text-[10px] text-gray-600 font-mono truncate">{cfg.uid}</div>
                                                                </td>
                                                                <td className="py-4 px-2">
                                                                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-400 text-[11px] uppercase tracking-wide">
                                                                        {cfg.environment}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 px-2">
                                                                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/5 border border-indigo-500/20 text-indigo-400 text-[11px] uppercase tracking-wide">
                                                                        {cfg.exe_logic}
                                                                    </span>
                                                                </td>
                                                                <td className="py-4 px-2 text-right sticky right-0 bg-gray-900 group-hover:bg-gray-800 transition-colors">
                                                                    <div className="flex justify-end gap-2">
                                                                        <button
                                                                            onClick={() => copyToClipboard(cfg)}
                                                                            className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all"
                                                                            title="Copy Installation Command"
                                                                        >
                                                                            <Copy className="w-3.5 h-3.5" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => setDeleteConfirmUid(cfg.uid)}
                                                                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                                                            title="Delete Configuration"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                {/* ABSOLUTELY SURE PROMPT REPLACEMENT */}
                                                                <td colSpan={3} className="py-4 px-4 align-middle">
                                                                    <div className="flex items-center gap-2 text-red-400 animate-in fade-in zoom-in-95 duration-150">
                                                                        <span className="text-xs font-bold uppercase tracking-wider">Are you absolutely sure?</span>
                                                                        <span className="text-[11px] text-gray-500 font-mono hidden sm:inline">({cfg.label || cfg.uid})</span>
                                                                    </div>
                                                                </td>
                                                                <td colSpan={2} className="py-4 px-2 text-right align-middle">
                                                                    <div className="flex justify-end gap-2 animate-in fade-in zoom-in-95 duration-150">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setDeleteConfirmUid(null)}
                                                                            className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-300 text-[10px] font-bold uppercase hover:bg-white/10 border border-white/5 transition-colors"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDelete(cfg.uid)}
                                                                            disabled={isDeleting}
                                                                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase hover:bg-red-500 shadow-lg shadow-red-900/20 disabled:opacity-50 min-w-25 flex items-center justify-center gap-1.5"
                                                                        >
                                                                            {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm Delete"}
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>

                                                    {/* Dynamic Details Row immediately below its parent */}
                                                    {isExpanded && !isConfirmingDelete && (
                                                        <tr className="bg-gray-950/40 border-l-2 border-indigo-500/40 animate-in fade-in slide-in-from-top-1 duration-200">
                                                            <td colSpan={5} className="p-5">
                                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-gray-400">
                                                                    {/* Column 1: Scheduling Details */}
                                                                    <div className="space-y-3 bg-white/1 border border-white/5 p-3 rounded-xl">
                                                                        <div className="font-semibold text-white flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                                                                            <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Scheduling & Execution
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-gray-500">Base URL:</span>
                                                                                <span className={`font-mono truncate ml-4 ${isAutoDetect ? 'text-gray-500 italic' : 'text-indigo-300'}`}>
                                                                                    {displayBaseUrl}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between"><span className="text-gray-500">Cron Rule:</span> <span className="font-mono text-indigo-300">{cfg.cron || "None"}</span></div>
                                                                            <div className="flex justify-between"><span className="text-gray-500">Patch Schedule:</span> <span className="font-mono text-indigo-300">{cfg.patching_schedule || "None"}</span></div>
                                                                            <div className="flex justify-between"><span className="text-gray-500">Created At:</span> <span className="text-gray-300">{cfg.created_at ? new Date(cfg.created_at).toLocaleString() : "Unknown"}</span></div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Column 2: Behavior & Safety Flag States */}
                                                                    <div className="space-y-3 bg-white/1 border border-white/5 p-3 rounded-xl">
                                                                        <div className="font-semibold text-white flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                                                                            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" /> Advanced Options
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-gray-500">Disable Autoremove:</span>
                                                                                <span className={`font-medium ${cfg.disable_autoremove ? 'text-amber-400' : 'text-gray-600'}`}>{cfg.disable_autoremove ? "True" : "False"}</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-gray-500">APT Release Info Change:</span>
                                                                                <span className={`font-medium ${cfg.enable_apt_release_info_change ? 'text-emerald-400' : 'text-gray-600'}`}>{cfg.enable_apt_release_info_change ? "Enabled" : "Disabled"}</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-gray-500">Max Allowed Uptime:</span>
                                                                                <span className="text-gray-300 font-mono">{cfg.max_allowed_uptime ? `${cfg.max_allowed_uptime}d` : "Unlimited"}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Column 3: Reboot Engine Rules & Security */}
                                                                    <div className="space-y-3 bg-white/1 border border-white/5 p-3 rounded-xl">
                                                                        <div className="font-semibold text-white flex items-center gap-1.5 border-b border-white/5 pb-1.5">
                                                                            <Settings className="w-3.5 h-3.5 text-amber-400" /> Reboot Actions & Security
                                                                        </div>
                                                                        <div className="space-y-1.5">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-gray-500">Reboot on Success:</span>
                                                                                <span className={`font-medium ${cfg.reboot_on_success ? 'text-emerald-400' : 'text-gray-600'}`}>{cfg.reboot_on_success ? "True" : "False"}</span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-gray-500">Reboot After Updates:</span>
                                                                                <span className={`font-medium ${cfg.reboot_after_updates ? 'text-emerald-400' : 'text-gray-600'}`}>{cfg.reboot_after_updates ? "True" : "False"}</span>
                                                                            </div>
                                                                            <div className="pt-1.5 border-t border-white/5 flex flex-col gap-1">
                                                                                <span className="text-gray-500 flex items-center gap-1"><Key className="w-3 h-3 text-indigo-400" /> API Key Context:</span>
                                                                                <span className="font-mono text-[10px] text-gray-500 bg-black/30 p-1 rounded block select-all break-all border border-white/5">
                                                                                    {cfg.key}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfigListModal;