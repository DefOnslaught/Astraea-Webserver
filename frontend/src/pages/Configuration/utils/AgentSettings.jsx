import { useState, useEffect, useRef } from "react";
import {
    FileCode, Upload, RefreshCw, Terminal, CheckCircle2, Loader2,
    Copy, Key, Calendar, Info, ChevronRight, Settings2, Command
} from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";
import CronModal from "./modals/CronModal";

const AgentTab = ({ triggerSuccess, setError }) => {
    // --- State Management ---
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [scriptVersion, setScriptVersion] = useState("");
    const [uploading, setUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Config States
    const [availableKeys, setAvailableKeys] = useState([]);
    const [agentConfig, setAgentConfig] = useState({
        schedule: "0 0 * * *",
        environment: "production",
        apiKeyName: "",
        helperScript: "default"
    });

    const [installUrl, setInstallUrl] = useState("");
    const [showCronModal, setShowCronModal] = useState(false);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchApiKeys = async () => {
            try {
                const res = await api.get(API_ENDPOINTS.API_KEYS);

                if (res.status === 200 && Array.isArray(res.data)) {
                    setAvailableKeys(res.data);
                    if (res.data.length > 0) {
                        setAgentConfig(prev => ({ ...prev, apiKeyName: res.data[0].name }));
                    }
                } else {
                    setAvailableKeys([]);
                }
            } catch (err) {
                setAvailableKeys([]);
                setError("Could not load API keys. Is the backend running?");
            } finally {
                setIsLoading(false);
            }
        };
        fetchApiKeys();
    }, [setError]);

    // --- Handlers ---
    const handleScriptUpload = async () => {
        if (!selectedFile || !scriptVersion) {
            setError("Version and .py file are required.");
            return;
        }
        const formData = new FormData();
        formData.append("script", selectedFile);
        formData.append("version", scriptVersion);

        setUploading(true);
        try {
            const res = await api.post(API_ENDPOINTS.AGENT_UPLOAD, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            if (res.status === 200) {
                triggerSuccess(`Master Script updated to v${scriptVersion}`);
                setSelectedFile(null);
                setScriptVersion("");
            } else {
                // Display errors or something
                setError(`Upload failed: ${res.message}`)
            }
        } catch (err) {
            setError("Upload failed. Ensure the file is a valid Python script.");
        } finally {
            setUploading(false);
        }
    };

    const handleCreateAgentInstaller = async () => {
        try {
            const res = await api.post(API_ENDPOINTS.AGENT_CREATION, agentConfig);
            setInstallUrl(`${window.location.origin}/api/config/install_script/${res.data.uuid}`);
            triggerSuccess("Deployment one-liner generated.");
        } catch (err) {
            setError("Failed to generate install path.");
        }
    };

    const copyToClipboard = async (text) => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                triggerSuccess("Command copied!");
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
                if (successful) triggerSuccess("Command copied!");
            }
        } catch (err) {
            setError("Failed to copy to clipboard.");
            console.error('Clipboard error:', err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-in fade-in slide-in-from-bottom-2">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Loading Agent Settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 1. SCRIPT UPLOAD SECTION */}
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileCode className="w-5 h-5 text-indigo-400" /> Master Agent Source
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">This script is served to all clients during updates.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-gray-900/40 p-5 rounded-2xl border border-white/5">
                    <div className="md:col-span-3">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block ml-1">Version</label>
                        <input
                            type="text"
                            placeholder="v2.1.0"
                            value={scriptVersion}
                            onChange={(e) => setScriptVersion(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-indigo-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="md:col-span-6">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block ml-1">Patching Agent</label>
                        <div
                            onClick={() => fileInputRef.current.click()}
                            className="cursor-pointer bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all flex items-center justify-between"
                        >
                            <span className="truncate">{selectedFile ? selectedFile.name : "patching_agent.tar"}</span>
                            <Upload className="w-4 h-4 text-indigo-400" />
                        </div>
                        <input type="file" ref={fileInputRef} hidden accept=".zip, .tar" onChange={(e) => setSelectedFile(e.target.files[0])} />
                    </div>

                    <div className="md:col-span-3 flex items-end">
                        <button
                            onClick={handleScriptUpload}
                            disabled={uploading}
                            className="w-full h-9.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Upload Script"}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. AGENT BUILDER SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 bg-gray-800/40 border border-white/5 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <Settings2 className="w-5 h-5 text-indigo-400" /> Easy Install Builder
                    </h3>

                    <div className="space-y-5">
                        {/* API Key Selection */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block ml-1">Assigned API Key</label>
                            <div className="relative">
                                <select
                                    value={agentConfig.apiKeyName}
                                    onChange={(e) => setAgentConfig({ ...agentConfig, apiKeyName: e.target.value })}
                                    className="w-full bg-gray-900 border border-white/10 rounded-xl px-10 py-3 text-white text-sm appearance-none focus:border-indigo-500/50 outline-none"
                                >
                                    {(availableKeys || []).map(k => (
                                        <option key={k.id} value={k.name}>{k.name}</option>
                                    ))}
                                    {(!availableKeys || availableKeys.length === 0) && <option disabled value="">No keys found</option>}
                                </select>
                                <Key className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                            </div>
                        </div>

                        {/* Helper Script Selection */}
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block ml-1">Execution Logic (Helper Script)</label>
                            <div className="relative">
                                <select
                                    value={agentConfig.helperScript}
                                    onChange={(e) => setAgentConfig({ ...agentConfig, helperScript: e.target.value })}
                                    className="w-full bg-gray-900 border border-white/10 rounded-xl px-10 py-3 text-white text-sm appearance-none focus:border-indigo-500/50 outline-none"
                                >
                                    <option value="default">Standard (Every Execution)</option>
                                    <option value="week1and3">Patching Week 1 & 3</option>
                                    <option value="week2and4">Patching Week 2 & 4</option>
                                </select>
                                <Command className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                            </div>
                            <p className="mt-1.5 px-1 text-[10px] text-gray-500 italic">
                                Selects the wrapper script used to run the Agent.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block ml-1">Environment</label>
                                <select
                                    value={agentConfig.environment}
                                    onChange={(e) => setAgentConfig({ ...agentConfig, environment: e.target.value })}
                                    className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-indigo-500/50 outline-none"
                                >
                                    <option value="production">Production</option>
                                    <option value="pre-prod">Pre-Production</option>
                                    <option value="dev">Development</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block ml-1">Cron Schedule</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={agentConfig.schedule}
                                        onChange={(e) => setAgentConfig({ ...agentConfig, schedule: e.target.value })}
                                        className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono focus:border-indigo-500/50 outline-none"
                                    />
                                    <button
                                        onClick={() => setShowCronModal(true)}
                                        className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
                                    >
                                        <Calendar className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleCreateAgentInstaller} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl text-sm font-bold mt-2 shadow-lg shadow-indigo-600/10 flex items-center justify-center gap-2 group">
                            Generate Deployment Command
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* 3. ONE-LINER INSTRUCTIONS */}
                <div className="lg:col-span-2 bg-gray-800/40 border border-white/5 rounded-2xl p-6 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Linux One-Liner
                    </h3>

                    <div className="flex-1 flex flex-col justify-center">
                        {installUrl ? (
                            <div className="space-y-4 animate-in zoom-in-95 duration-200">
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-linear-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                                    <pre className="relative bg-black/60 p-5 rounded-xl border border-white/10 text-[11px] text-indigo-300 overflow-x-auto font-mono leading-relaxed select-all">
                                        curl -sSL {installUrl} | sudo bash
                                    </pre>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyToClipboard(`curl -sSL ${installUrl} | sudo bash`);
                                        }}
                                        type="button"
                                        className="absolute top-2 right-2 p-2 bg-gray-800 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors z-10"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                                    <Info className="w-4 h-4 text-emerald-500 mt-0.5" />
                                    <p className="text-[10px] text-gray-400 leading-normal italic">
                                        This URL is temporary and unique to this config. It injects your API Key and Cron schedule into the agent environment automatically.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-white/5 rounded-2xl grayscale opacity-50">
                                <Terminal className="w-10 h-10 text-gray-600 mb-3" />
                                <p className="text-gray-500 text-sm">Configure builder to generate path</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Cron Helper Modal */}
            {showCronModal && (
                <CronModal
                    currentValue={agentConfig.schedule}
                    onSave={(val) => setAgentConfig({ ...agentConfig, schedule: val })}
                    onClose={() => setShowCronModal(false)}
                />
            )}
        </div>
    );
};

export default AgentTab;