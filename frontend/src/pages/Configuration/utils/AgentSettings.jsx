import { useState, useEffect, useRef } from "react";
import {
    FileCode, Upload, RefreshCw, Terminal, CheckCircle2, Loader2,
    Copy, Key, Calendar, ChevronRight, Settings2, Command, ChevronDown,
    History, ShieldAlert, Sliders, ToggleLeft, ToggleRight, Globe
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";
import CronModal from "./modals/CronModal";
import ConfigListModal from "./modals/ConfigListModal";
import cronstrue from "cronstrue";

const AgentTab = ({ triggerSuccess, setError }) => {
    // --- State Management ---
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [scriptVersion, setScriptVersion] = useState("");
    const [uploading, setUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [currentVersion, setCurrentVersion] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const [availableKeys, setAvailableKeys] = useState([]);
    const [agentConfig, setAgentConfig] = useState({
        label: "",
        base_url: "",
        schedule: "0 0 * * *",
        environment: "Production",
        apiKeyName: "",
        helperScript: "standard",
        disable_autoremove: false,
        enable_apt_release_info_change: false,
        reboot_on_success: false,
        reboot_after_updates: true,
        max_allowed_uptime: 20
    });

    const [installUrl, setInstallUrl] = useState("");
    const [showCronModal, setShowCronModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);

    // --- Data Fetching ---
    useEffect(() => {
        const fetchApiKeys = async () => {
            try {
                const res = await api.get(API_ENDPOINTS.API_KEY_GET_ALL);
                if (res.status === 200 && Array.isArray(res.data)) {
                    setAvailableKeys(res.data);
                    if (!agentConfig.apiKeyName) {
                        const firstActive = res.data.find(k => k.is_active);
                        if (firstActive) {
                            setAgentConfig(prev => ({ ...prev, apiKeyName: firstActive.name }));
                        }
                    }
                }
            } catch (err) {
                setError("Could not load API keys.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchApiKeys();

        const fetchCurrentVersion = async () => {
            try {
                const res = await api.get(API_ENDPOINTS.AGENT_UPLOAD, {
                    params: { version: true }
                });
                if (res.status === 200) {
                    setCurrentVersion(res.data.version);
                }
            } catch (err) {
                setError("Could not load current version.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchCurrentVersion();
    }, []);

    const currentKeyData = availableKeys.find(k => k.name === agentConfig.apiKeyName);
    const isCurrentKeyDisabled = currentKeyData && !currentKeyData.is_active;

    useEffect(() => {
        if (installUrl) setInstallUrl("");
    }, [agentConfig]);

    // --- Handlers ---
    const handleScriptUpload = async () => {
        if (!selectedFile || !scriptVersion) {
            setError("Version and File are required.");
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
                setCurrentVersion(scriptVersion);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Upload failed. Ensure the file is a valid Python script.");
        } finally {
            setUploading(false);
        }
    };

    const handleScriptDownload = async () => {
        setDownloading(true);
        try {
            const res = await api.get(API_ENDPOINTS.AGENT_UPLOAD, {
                responseType: 'blob',
            });

            if (res.status === 200) {
                const blob = new Blob([res.data], { type: 'application/gzip' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', 'astraea_agent.tar.gz');
                document.body.appendChild(link);
                link.click();
                link.parentNode.removeChild(link);
                window.URL.revokeObjectURL(url);
                triggerSuccess("Download started.");
            }
        } catch (err) {
            setError("Failed to download script, is one uploaded?");
        } finally {
            setDownloading(false);
        }
    };

    const formatPatchingSchedule = (schedule, helperScript) => {
        try {
            let humanCron = cronstrue.toString(schedule, { use24HourTimeFormat: false });
            humanCron = humanCron.replace("At ", "").replace(", only on", "");

            const logicLabels = {
                "standard": "",
                "week1and3": " Weeks 1 & 3",
                "week2and4": " Weeks 2 & 4",
                "week1": " Week 1",
                "week2": " Week 2",
                "week3": " Week 3",
                "week4": " Week 4"
            };

            const weekSuffix = logicLabels[helperScript] || "";
            return `${humanCron}${weekSuffix}`.trim();
        } catch (err) {
            return "Invalid Schedule";
        }
    };

    const handleCreateAgentInstaller = async () => {
        try {
            const patchingScheduleStr = formatPatchingSchedule(
                agentConfig.schedule,
                agentConfig.helperScript
            );

            const payload = {
                ...agentConfig,
                patching_schedule: patchingScheduleStr
            };

            const res = await api.post(API_ENDPOINTS.AGENT_CREATE_CONFIG, payload);

            let finalBaseUrl = window.location.origin;

            if (agentConfig.base_url && typeof agentConfig.base_url === 'string' && agentConfig.base_url.trim() !== "") {
                try {
                    new URL(agentConfig.base_url);
                    finalBaseUrl = agentConfig.base_url.trim().replace(/\/$/, "");
                } catch (e) {
                    console.warn("Invalid base_url provided, falling back to window.location.origin");
                }
            }
            setInstallUrl(`${finalBaseUrl}/api/config/install_script/${res.data.uuid}/`);
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
        }
    };

    const toggleFlag = (flagName) => {
        setAgentConfig(prev => ({ ...prev, [flagName]: !prev[flagName] }));
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <p className="text-sm font-medium">Loading Agent Settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* 1. SCRIPT UPLOAD SECTION */}
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FileCode className="w-5 h-5 text-indigo-400" /> Master Agent Source
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">This script is served to all clients during updates.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {currentVersion && (
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Current Version</span>
                                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                    {currentVersion}
                                </span>
                            </div>
                        )}
                        <button
                            onClick={handleScriptDownload}
                            disabled={downloading}
                            className="p-2.5 bg-gray-800 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-gray-700 transition-all flex items-center gap-2"
                        >
                            {downloading && <Loader2 className="w-4 h-4 animate-spin" />}
                            <span className="text-xs font-medium pr-1">Download</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-gray-900/40 p-5 rounded-2xl border border-white/5">
                    <div className="md:col-span-3">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block ml-1">Version</label>
                        <input
                            type="text"
                            placeholder={`e.g. 1.0.0`}
                            value={scriptVersion}
                            onChange={(e) => setScriptVersion(e.target.value)}
                            className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:border-indigo-500/50 outline-none transition-all"
                        />
                    </div>

                    <div className="md:col-span-6">
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-2 block ml-1">Patching Agent File</label>
                        <div
                            onClick={() => fileInputRef.current.click()}
                            className="cursor-pointer bg-gray-800 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-400 hover:text-white hover:border-white/20 transition-all flex items-center justify-between"
                        >
                            <span className="truncate">{selectedFile ? selectedFile.name : "Select .tar or .zip "}</span>
                            <Upload className="w-4 h-4 text-indigo-400" />
                        </div>
                        <input type="file" ref={fileInputRef} hidden accept=".zip, .tar.gz, .tar" onChange={(e) => setSelectedFile(e.target.files[0])} />
                    </div>

                    <div className="md:col-span-3 flex items-end">
                        <button
                            onClick={handleScriptUpload}
                            disabled={uploading || !scriptVersion || !selectedFile}
                            className="w-full h-9.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Upload Script"}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. RE-DESIGNED UNIFIED EASY INSTALL BUILDER */}
            <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Settings2 className="w-5 h-5 text-indigo-400" /> Easy Install Builder
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Configure environment behaviors and orchestrate execution rules</p>
                    </div>
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 hover:text-white transition-all"
                    >
                        <History className="w-3.5 h-3.5 text-indigo-400" />
                        View History
                    </button>
                </div>

                {/* Primary Field Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block ml-1">Configuration Label</label>
                        <div className="relative group">
                            <input
                                required
                                type="text"
                                placeholder="e.g. Ubuntu Web Servers - Prod"
                                value={agentConfig.label}
                                onChange={(e) => setAgentConfig({ ...agentConfig, label: e.target.value })}
                                className={`w-full bg-gray-900 border rounded-xl px-10 py-2.5 text-white text-sm outline-none transition-all ${!agentConfig.label.trim() ? 'border-amber-500/20' : 'border-white/10 focus:border-indigo-500/50'
                                    }`}
                            />
                            <Settings2 className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block ml-1">Assigned API Key</label>
                        <div className="relative group">
                            <select
                                value={agentConfig.apiKeyName || ""}
                                onChange={(e) => setAgentConfig({ ...agentConfig, apiKeyName: e.target.value })}
                                className={`w-full bg-gray-900 border rounded-xl px-10 py-2.5 text-sm appearance-none outline-none transition-all cursor-pointer ${isCurrentKeyDisabled ? 'border-red-500/50 text-red-200' : 'border-white/10 text-white focus:border-indigo-500/50'
                                    }`}
                            >
                                <option value="" disabled hidden>Select an API Key...</option>
                                {availableKeys.sort((a, b) => b.is_active - a.is_active).map(k => (
                                    <option key={k.id} value={k.name} className="bg-gray-900">
                                        {k.name} {!k.is_active ? '(disabled)' : ''}
                                    </option>
                                ))}
                            </select>
                            <Key className={`absolute left-3.5 top-3.5 w-4 h-4 ${isCurrentKeyDisabled ? 'text-red-400' : 'text-gray-500'}`} />
                            <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block ml-1">Environment Scope</label>
                        <select
                            value={agentConfig.environment}
                            onChange={(e) => setAgentConfig({ ...agentConfig, environment: e.target.value })}
                            className="w-full bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-indigo-500/50 outline-none cursor-pointer"
                        >
                            <option value="Production">Production</option>
                            <option value="Pre-Prod">Pre-Production</option>
                            <option value="Dev">Development</option>
                        </select>
                    </div>

                    {/* Base URL Override */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block ml-1">Base URL Override (Optional)</label>
                        <div className="relative group">
                            <input
                                type="url"
                                placeholder="e.g. https://astraea.example.com"
                                value={agentConfig.base_url}
                                onChange={(e) => setAgentConfig({ ...agentConfig, base_url: e.target.value })}
                                className="w-full bg-gray-900 border border-white/10 rounded-xl px-10 py-2.5 text-white text-sm focus:border-indigo-500/50 outline-none transition-all placeholder:text-gray-600"
                            />
                            <Globe className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                        </div>
                        <p className="text-[10px] text-gray-500 mt-1.5 ml-1">Leave blank to auto-detect from the host request.</p>
                    </div>
                </div>

                {/* Scheduling Panel Block */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-gray-900/30 p-5 rounded-xl border border-white/5">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block ml-1">Execution Logic Strategy</label>
                        <div className="relative group">
                            <select
                                value={agentConfig.helperScript}
                                onChange={(e) => setAgentConfig({ ...agentConfig, helperScript: e.target.value })}
                                className="w-full bg-gray-900 border border-white/10 rounded-xl px-10 py-2.5 text-white text-sm appearance-none focus:border-indigo-500/50 outline-none cursor-pointer"
                            >
                                <option value="standard">Standard (Every Execution)</option>
                                <option value="week1and3">Patching Week 1 & 3</option>
                                <option value="week2and4">Patching Week 2 & 4</option>
                                <option value="week1">Patching Week 1</option>
                                <option value="week2">Patching Week 2</option>
                                <option value="week3">Patching Week 3</option>
                                <option value="week4">Patching Week 4</option>
                            </select>
                            <Command className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                            <ChevronDown className="absolute right-3.5 top-3.5 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase mb-2 block ml-1">Cron Evaluation</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={agentConfig.schedule}
                                onChange={(e) => setAgentConfig({ ...agentConfig, schedule: e.target.value })}
                                className="flex-1 bg-gray-900 border border-white/10 rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:border-indigo-500/50 outline-none"
                            />
                            <button
                                onClick={() => setShowCronModal(true)}
                                className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all"
                            >
                                <Calendar className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[11px] text-indigo-400 mt-2 ml-1 font-mono italic">
                            Parsed Target: {formatPatchingSchedule(agentConfig.schedule, agentConfig.helperScript)}
                        </p>
                    </div>
                </div>

                {/* ADVANCED AUTOMATION POLICIES MATRIX */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 ml-1">
                        <Sliders className="w-3.5 h-3.5 text-indigo-400" /> System Automation Policies
                    </h4>

                    {/* Clean, unified grid where peer cells auto-stretch to match the tallest row element */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* CARD 1: Disable Autoremove */}
                        <div className="flex items-center justify-between p-3.5 bg-gray-900/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors min-h-22.5">
                            <div className="pr-4">
                                <p className="text-sm font-semibold text-slate-200">Disable Autoremove</p>
                                <p className="text-xs text-slate-500 mt-0.5">Prevents automatic purge of unused dependency files.</p>
                            </div>
                            <button type="button" onClick={() => toggleFlag('disable_autoremove')} className="text-indigo-400 transition-transform active:scale-95 shrink-0">
                                {agentConfig.disable_autoremove ? <ToggleRight className="w-8 h-8 text-indigo-500" /> : <ToggleLeft className="w-8 h-8 text-gray-600" />}
                            </button>
                        </div>

                        {/* CARD 2: Reboot On Success */}
                        <div className="flex items-center justify-between p-3.5 bg-gray-900/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors min-h-22.5">
                            <div className="pr-4">
                                <p className="text-sm font-semibold text-slate-200">Reboot On Success</p>
                                <p className="text-xs text-slate-500 mt-0.5">Reboots the node instantly following clean runs.</p>
                            </div>
                            <button type="button" onClick={() => toggleFlag('reboot_on_success')} className="text-indigo-400 transition-transform active:scale-95 shrink-0">
                                {agentConfig.reboot_on_success ? <ToggleRight className="w-8 h-8 text-indigo-500" /> : <ToggleLeft className="w-8 h-8 text-gray-600" />}
                            </button>
                        </div>

                        {/* CARD 3: Enable APT Release Info Change */}
                        <div className="flex items-center justify-between p-3.5 bg-gray-900/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors min-h-22.5">
                            <div className="pr-4">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-200">Enable APT Release Info Change</p>
                                    {/* Warning Info Icon with enhanced tooltip */}
                                    <span
                                        title="ADVANCED SETTING: This option enables the '--allow-releaseinfo-change' flag in APT. 
                
Use only if you are experiencing 'Repository changed its Release file' errors. Enabling this on an incorrect repository can result in insecure updates or broken package dependencies. Intended for Debian-based systems only. If you are unsure, leave this disabled."
                                        className="cursor-help text-amber-500/70 hover:text-amber-400 transition-all animate-pulse"
                                    >
                                        <FontAwesomeIcon icon={faCircleInfo} className="w-3.5 h-3.5" />
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">Permit system upgrades even if the repository release origin has changed.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleFlag('enable_apt_release_info_change')}
                                className="text-indigo-400 transition-transform active:scale-95 shrink-0"
                            >
                                {agentConfig.enable_apt_release_info_change ?
                                    <ToggleRight className="w-8 h-8 text-indigo-500" /> :
                                    <ToggleLeft className="w-8 h-8 text-gray-600" />
                                }
                            </button>
                        </div>

                        {/* CARD 4: Reboot After Updates */}
                        <div className="flex items-center justify-between p-3.5 bg-gray-900/40 rounded-xl border border-white/5 hover:border-white/10 transition-colors min-h-22.5">
                            <div className="pr-4">
                                <p className="text-sm font-semibold text-slate-200">Reboot After Updates</p>
                                <p className="text-xs text-slate-500 mt-0.5">Reboots the node instantly after an update (min. 1 package updated).</p>
                            </div>
                            <button type="button" onClick={() => toggleFlag('reboot_after_updates')} className="text-indigo-400 transition-transform active:scale-95 shrink-0">
                                {agentConfig.reboot_after_updates ? <ToggleRight className="w-8 h-8 text-indigo-500" /> : <ToggleLeft className="w-8 h-8 text-gray-600" />}
                            </button>
                        </div>

                    </div>

                    {/* Number Box Allocation Row */}
                    <div className="p-4 bg-gray-900/40 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold text-slate-200">Max Allowed Uptime Threshold</p>
                            <p className="text-xs text-slate-500">Reboots the node if we are over the max time. Set to 0 to disable, overrides other options</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="number"
                                min="1"
                                max="365"
                                value={agentConfig.max_allowed_uptime}
                                onChange={(e) => setAgentConfig({ ...agentConfig, max_allowed_uptime: parseInt(e.target.value) || 0 })}
                                className="w-24 bg-gray-900 border border-white/10 rounded-xl px-3 py-2 text-white text-center font-mono text-sm focus:border-indigo-500/50 outline-none"
                            />
                            <span className="text-xs font-medium text-slate-400">Days</span>
                        </div>
                    </div>
                </div>

                {/* Unified Generation Execution Block */}
                <button
                    onClick={handleCreateAgentInstaller}
                    disabled={!agentConfig.apiKeyName || isCurrentKeyDisabled || !agentConfig.label.trim()}
                    className={`w-full py-3.5 rounded-xl text-sm font-bold shadow-xl flex items-center justify-center gap-2 group transition-all ${(!agentConfig.apiKeyName || isCurrentKeyDisabled || !agentConfig.label.trim())
                            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-500 text-white"
                        }`}
                >
                    {isCurrentKeyDisabled
                        ? "Invalid API Key Selection"
                        : !agentConfig.label.trim()
                            ? "Enter a Configuration Label to Proceed"
                            : "Generate Deployment Script Execution Path"}
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* 3. FLUSH FULL-WIDTH LINUX DEPLOYMENT DECK */}
                <div className="border-t border-white/5 pt-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Deployment Deck Matrix</h4>
                    </div>

                    {installUrl ? (
                        <div className="relative group animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="absolute -inset-0.5 bg-linear-to-r from-indigo-500 to-emerald-500 rounded-xl blur opacity-15 group-hover:opacity-30 transition duration-700"></div>
                            <div className="relative bg-black/50 rounded-xl border border-white/10 flex items-center justify-between p-4 pl-5">
                                <code className="text-xs font-mono text-indigo-300 truncate pr-12 select-all">
                                    curl -sSL <span className="text-emerald-400">{installUrl}</span> | sudo bash
                                </code>
                                <button
                                    onClick={() => copyToClipboard(`curl -sSL ${installUrl} | sudo bash`)}
                                    className="p-2.5 bg-gray-900 hover:bg-gray-800 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors flex items-center gap-2 shrink-0 text-xs font-medium"
                                >
                                    <Copy className="w-3.5 h-3.5 text-indigo-400" />
                                    Copy Script
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center justify-center gap-3 p-5 border border-dashed border-white/5 rounded-xl bg-gray-900/10 text-center text-slate-500">
                            <ShieldAlert className="w-4 h-4 text-slate-600" />
                            <p className="text-xs font-medium">
                                {isCurrentKeyDisabled ? "Please assign an active environment key" : "Finalize system options above and commit configuration properties to open terminal deck"}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {showCronModal && (
                <CronModal
                    currentValue={agentConfig.schedule}
                    onSave={(val) => setAgentConfig({ ...agentConfig, schedule: val })}
                    onClose={() => setShowCronModal(false)}
                />
            )}

            {showConfigModal && (
                <ConfigListModal
                    onClose={() => setShowConfigModal(false)}
                />
            )}
        </div>
    );
};

export default AgentTab;