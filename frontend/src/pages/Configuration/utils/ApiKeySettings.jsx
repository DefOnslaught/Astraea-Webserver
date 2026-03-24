import { useState, useEffect } from "react";
import { Key, Plus, Copy, Trash2, X, RefreshCw, Loader2, Edit3 } from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";

const ApiKeySettings = ({ triggerSuccess, setError }) => {
    const [apiKeys, setApiKeys] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newKeyName, setNewKeyName] = useState("");

    // Edit Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingKey, setEditingKey] = useState(null);
    const [editName, setEditName] = useState("");
    const [isUpdating, setIsUpdating] = useState(false);

    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        fetchKeys();
    }, []);

    const fetchKeys = async () => {
        try {
            const res = await api.get(API_ENDPOINTS.API_KEY_GET_ALL);
            if (res.status === 200 && Array.isArray(res.data)) {
                setApiKeys(res.data);
            } else {
                setApiKeys([]);
            }
        } catch (err) {
            setError("API Key endpoint not found or unreachable.");
            setApiKeys([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGenerateKey = async (e) => {
        e.preventDefault();
        if (!newKeyName.trim()) return;

        setIsCreating(true);
        try {
            const res = await api.post(API_ENDPOINTS.API_KEY_CREATE, { name: newKeyName });
            setApiKeys([...apiKeys, res.data]);
            setNewKeyName("");
            setShowCreateModal(false);
            triggerSuccess("API Key generated successfully.");
        } catch (err) {
            setError("Could not generate API key.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleUpdateKey = async (id, data) => {
        setIsUpdating(true);
        try {
            const res = await api.patch(API_ENDPOINTS.API_KEY_UPDATE, {
                id: id,
                ...data
            });
            if (res.status === 200) {
                setApiKeys(apiKeys.map(k => k.id === id ? { ...k, ...data } : k));
                triggerSuccess("Key updated.");
                setShowEditModal(false);
            }
        } catch (err) {
            setError("Failed to update API key.");
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDeleteKey = async (id) => {
        setIsDeleting(true);
        try {
            const res = await api.delete(API_ENDPOINTS.API_KEY_DELETE, {
                data: { id: id }
            });
            if (res.status === 200) {
                setApiKeys(apiKeys.filter(k => k.id !== id));
                triggerSuccess("API Key revoked.");
                setConfirmDeleteId(null);
            }
        } catch (err) {
            setError("Failed to delete API key.");
        } finally {
            setIsDeleting(false);
        }
    };

    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                triggerSuccess("Key copied!");
            } else {
                // Fallback for non-HTTPS or older browsers
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) triggerSuccess("Key copied!");
            }
        } catch (err) {
            setError("Failed to copy to clipboard.");
            console.error('Clipboard error:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Loading API Access...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-400" /> API Access Keys
                    </h3>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                    >
                        <Plus className="w-4 h-4" /> New Key
                    </button>
                </div>

                <div className="space-y-3">
                    {apiKeys.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-white/5 rounded-xl">
                            <p className="text-gray-500 text-sm italic">No API keys generated yet.</p>
                        </div>
                    ) : (
                        apiKeys.map(key => (
                            <div key={key.id} className="group relative overflow-hidden transition-all">
                                <div className={`flex items-center justify-between p-4 bg-gray-900/80 rounded-xl border transition-colors ${confirmDeleteId === key.id ? 'border-red-500/40 bg-red-500/5' : 'border-white/5'}`}>
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className={`text-[10px] font-bold uppercase tracking-widest ${key.is_active ? 'text-gray-500' : 'text-gray-600 line-through'}`}>
                                                {key.name || 'Unnamed Key'}
                                            </p>
                                            {!key.is_active && (
                                                <span className="text-[8px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded uppercase font-black">Disabled</span>
                                            )}
                                        </div>
                                        <code className={`text-xs font-mono break-all transition-all duration-300 ${key.is_active ? 'text-indigo-300' : 'text-gray-700 line-through opacity-50'}`}>
                                            {key.key}
                                        </code>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {confirmDeleteId !== key.id ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditingKey(key);
                                                        setEditName(key.name);
                                                        setShowEditModal(true);
                                                    }}
                                                    className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                    title="Edit Key"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => copyToClipboard(key.key)}
                                                    className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                    title="Copy Key"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(key.id)}
                                                    className="p-2 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Revoke Key"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2 animate-in slide-in-from-right-2 duration-200">
                                                <button onClick={() => setConfirmDeleteId(null)} className="px-3 py-1 text-[10px] font-bold text-gray-400 hover:text-white">Cancel</button>
                                                <button onClick={() => handleDeleteKey(key.id)} disabled={isDeleting} className="px-3 py-1 bg-red-600 text-white text-[10px] font-bold rounded">
                                                    {isDeleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Confirm Revoke'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Edit Key Modal */}
            {showEditModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Modify API Key</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">New Label</label>
                                <input
                                    autoFocus
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                                <div>
                                    <p className="text-xs font-bold text-white">Enable Key</p>
                                    <p className="text-[10px] text-gray-500">Allow this key to authenticate requests</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingKey({ ...editingKey, is_active: !editingKey.is_active })}
                                    className={`w-10 h-5 rounded-full transition-all relative ${editingKey?.is_active ? 'bg-indigo-600' : 'bg-gray-700'}`}
                                >
                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${editingKey?.is_active ? 'left-6' : 'left-1'}`} />
                                </button>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowEditModal(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-[10px] font-bold uppercase hover:bg-white/10">Cancel</button>
                                <button
                                    onClick={() => handleUpdateKey(editingKey.id, {
                                        name: editName,
                                        is_active: editingKey.is_active
                                    })}
                                    disabled={isUpdating || !editName.trim()}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/20"
                                >
                                    {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white">Generate API Key</h3>
                            <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleGenerateKey} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">Key Label</label>
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="e.g. Production Web Agent"
                                    value={newKeyName}
                                    onChange={(e) => setNewKeyName(e.target.value)}
                                    className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 py-2 rounded-lg bg-white/5 text-gray-300 text-[10px] font-bold uppercase hover:bg-white/10">Cancel</button>
                                <button type="submit" disabled={isCreating || !newKeyName.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl text-sm font-bold transition-all">
                                    {isCreating ? <RefreshCw className="w-4 h-4 animate-spin mx-auto" /> : "Generate"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ApiKeySettings;