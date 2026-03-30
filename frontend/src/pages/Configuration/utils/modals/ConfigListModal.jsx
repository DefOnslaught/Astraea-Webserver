import { useState, useEffect } from "react";
import { X, Trash2, Copy, Loader2, Database, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import api from "../../../../utils/api";
import { API_ENDPOINTS } from "../../../../utils/constants";

const ConfigListModal = ({ onClose }) => {
    const [configs, setConfigs] = useState([]);
    const [loading, setLoading] = useState(true);

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

    useEffect(() => { fetchConfigs(); }, []);

    const handleDelete = async (uid) => {
        setIsDeleting(true);
        try {
            await api.delete(API_ENDPOINTS.DELETE_AGENT_INSTALL_CONFIG, { data: { uid } });
            showStatus("success", "Configuration deleted.");
            setConfigs(configs.filter(c => c.uid !== uid));
            setDeleteConfirmUid(null);
        } catch (err) {
            showStatus("error", "Delete failed.");
        } finally {
            setIsDeleting(false);
        }
    };

    const copyToClipboard = async (uid) => {
        const url = `${window.location.origin}/api/config/install_script/${uid}`;
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gray-900/50">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Database className="w-5 h-5 text-indigo-400" /> Deployment History
                            </h2>
                            <p className="text-sm text-gray-500">Manage previously generated agent configurations.</p>
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
                                <table className="w-full text-left text-sm min-w-200">
                                    <thead>
                                        <tr className="text-gray-500 border-b border-white/5 uppercase text-[10px] font-bold tracking-wider">
                                            <th className="pb-3 px-2">Label</th>
                                            <th className="pb-3 px-2">Environment</th>
                                            <th className="pb-3 px-2">Execution Logic</th>
                                            <th className="pb-3 px-2">Schedule</th>
                                            <th className="pb-3 px-2 text-right sticky right-0 bg-gray-900">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {configs.map((cfg) => (
                                            <tr key={cfg.uid} className={`group transition-colors ${deleteConfirmUid === cfg.uid ? 'bg-red-500/5' : 'hover:bg-white/2'}`}>
                                                <td className="py-4 px-2">
                                                    <div className="text-indigo-300 font-medium">{cfg.label || "Unnamed Config"}</div>
                                                    <div className="text-[10px] text-gray-600 font-mono">{cfg.uid}</div>
                                                </td>
                                                <td className="py-4 px-2">
                                                    <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-400 text-[11px] uppercase">
                                                        {cfg.environment}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-2">
                                                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/5 border border-indigo-500/20 text-indigo-400 text-[11px] uppercase">
                                                        {cfg.exe_logic}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-2 text-gray-400 font-mono text-xs">
                                                    {cfg.cron}
                                                </td>
                                                <td className="py-4 px-2 text-right sticky right-0 bg-gray-900 group-hover:bg-gray-800 transition-colors">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => copyToClipboard(cfg.uid)}
                                                            className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg hover:bg-indigo-500 hover:text-white transition-all"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirmUid(cfg.uid)}
                                                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Delete Confirmation */}
                            {deleteConfirmUid && (
                                <div className="p-4 border border-red-500/40 rounded-xl bg-red-900/20 animate-in zoom-in-95 duration-200">
                                    <p className="text-xs font-bold text-red-400 text-center mb-4 italic">
                                        Delete configuration "{configs.find(c => c.uid === deleteConfirmUid)?.label || deleteConfirmUid}"?
                                    </p>
                                    <div className="flex gap-2 max-w-xs mx-auto">
                                        <button
                                            type="button"
                                            onClick={() => setDeleteConfirmUid(null)}
                                            className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-[10px] font-bold uppercase hover:bg-white/10 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(deleteConfirmUid)}
                                            disabled={isDeleting}
                                            className="flex-1 py-2 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase hover:bg-red-500 shadow-lg shadow-red-900/40 disabled:opacity-50"
                                        >
                                            {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin mx-auto" /> : "Confirm Delete"}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfigListModal;