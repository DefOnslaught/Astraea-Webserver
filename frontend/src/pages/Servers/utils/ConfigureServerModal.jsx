import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../utils/api';
import { API_ENDPOINTS } from "../../../utils/constants";
import SectionLoader from '../../../components/SectionLoader';

const ConfigureServerModal = ({ server_id, onClose, onUpdateSuccess }) => {
    const [formData, setFormData] = useState({
        enable_patching: true,
        patch_schedule: '',
        env: ''
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [serverInfo, setServerInfo] = useState(null);
    const [error, setError] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    // 1. Fetch current settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get(`${API_ENDPOINTS.UPDATE_SERVER}?server_id=${server_id}`);
                setServerInfo(res.data);
                setFormData({
                    enable_patching: res.data.enable_patching,
                    patch_schedule: res.data.patch_schedule || '',
                    env: res.data.env || ''
                });
            } catch (err) {
                setError("Failed to fetch server config");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, [server_id]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setIsSaving(true);

        try {
            await api.post(API_ENDPOINTS.UPDATE_SERVER, {
                server_id: server_id,
                ...formData
            });

            onUpdateSuccess();
            
            onClose();

        } catch (err) {
            const msg = err.response?.data?.message || "Failed to update server configuration.";
            setError(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setError("");
        setIsDeleting(true);
        try {
            await api.delete(API_ENDPOINTS.DELETE_SERVER, {
                data: {
                    server_id: server_id
                }
            });
            onUpdateSuccess();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to delete server.");
            setShowDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const AgentWarning = () => (
        <div className="flex items-center gap-1.5 mt-1.5 px-1 text-[10px] text-amber-500/80 italic font-medium">
            <i className="fa-solid fa-circle-info text-[9px]"></i>
            <span>Note: This value is overwritten by Astraea Agent</span>
        </div>
    );

    if (isLoading) return <SectionLoader label="Fetching Server..." />;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-white/5 bg-indigo-500/5 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Configure Server</h2>
                        <p className="text-xs text-gray-500 font-mono mt-1">{serverInfo?.hostname}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[80vh]">
                    {error && (
                        <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
                            <i className="fa-solid fa-circle-exclamation"></i>
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Standard Inputs */}
                        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                            <div className="flex flex-col">
                                <span className="text-sm font-semibold text-gray-200">Enable Patching</span>
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Automation Master Switch</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.enable_patching}
                                    onChange={(e) => setFormData({ ...formData, enable_patching: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                            </label>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Environment</label>
                            <input
                                type="text"
                                value={formData.env}
                                onChange={(e) => setFormData({ ...formData, env: e.target.value })}
                                className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                            />
                            <AgentWarning />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">Patch Schedule</label>
                            <input
                                type="text"
                                value={formData.patch_schedule}
                                onChange={(e) => setFormData({ ...formData, patch_schedule: e.target.value })}
                                className="w-full bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                            />
                            <AgentWarning />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition-all">
                                Cancel
                            </button>
                            <button type="submit" disabled={isSaving || isDeleting} className="flex-1 px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-all disabled:opacity-50">
                                {isSaving ? <i className="fa-solid fa-circle-notch animate-spin"></i> : "Save Changes"}
                            </button>
                        </div>
                    </form>

                    {/* DANGER ZONE - ISOLATED SECTION */}
                    <div className="mt-4 p-6 bg-red-500/5 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-4">
                            <i className="fa-solid fa-skull-crossbones text-red-500/50 text-xs"></i>
                            <h3 className="text-xs font-bold text-red-500/70 uppercase tracking-[0.2em]">Danger Zone</h3>
                        </div>

                        {!showDeleteConfirm ? (
                            <div className="flex items-center justify-between p-4 border border-red-500/20 rounded-xl bg-red-500/5">
                                <div className="max-w-[200px]">
                                    <p className="text-xs font-bold text-gray-300">Remove Server</p>
                                    <p className="text-[10px] text-gray-500 leading-tight mt-1">Permanently delete this node from Astraea inventory.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="px-3 py-2 rounded-lg border border-red-500/30 text-red-500 text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white transition-all"
                                >
                                    Delete
                                </button>
                            </div>
                        ) : (
                            <div className="p-4 border border-red-500/40 rounded-xl bg-red-900/20 animate-in zoom-in-95 duration-200">
                                <p className="text-xs font-bold text-red-400 text-center mb-4">Are you absolutely sure?</p>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteConfirm(false)}
                                        className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-[10px] font-bold uppercase hover:bg-white/10"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="flex-1 py-2 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase hover:bg-red-500 shadow-lg shadow-red-900/40"
                                    >
                                        {isDeleting ? <i className="fa-solid fa-circle-notch animate-spin"></i> : "Confirm Delete"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ConfigureServerModal;