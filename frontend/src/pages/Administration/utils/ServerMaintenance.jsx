import { useState, useEffect } from "react";
import { RefreshCw, Database, AlertTriangle, Skull, Cpu, CheckCircle, Clock, Play } from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";

const ServerTools = ({ triggerSuccess, setError }) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [isPurging, setIsPurging] = useState(false);
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
    const [isLoadingTasks, setIsLoadingTasks] = useState(true);
    const [celeryStats, setCeleryStats] = useState({
        workers: [],
        scheduled_tasks: [],
        active_tasks: []
    });
    const [killTarget, setKillTarget] = useState(null);
    const [dbStats, setDbStats] = useState(null);
    const [isLoadingDb, setIsLoadingDb] = useState(false);
    const [sysStats, setSysStats] = useState(null);
    const [isLoadingSys, setIsLoadingSys] = useState(false);
    const [downloadingFile, setDownloadingFile] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                await api.get(API_ENDPOINTS.RESET_CACHE);
            } catch (error) {
                if (error.response?.status === 429) {
                    setIsRefreshing(true);
                    pollRefreshStatus();
                }
            }
        };
        checkStatus();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get(API_ENDPOINTS.CELERY_STATS);
            setCeleryStats(res.data);
        } catch (err) {
            console.error("Failed to fetch celery stats");
        } finally {
            setIsLoadingTasks(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    const pollRefreshStatus = async () => {
        const interval = setInterval(async () => {
            try {
                await api.get(API_ENDPOINTS.RESET_CACHE);
                setIsRefreshing(false);
                triggerSuccess("Cache refresh completed successfully!");
                clearInterval(interval);
            } catch (error) {
                if (error.response?.status !== 429) {
                    setIsRefreshing(false);
                    setError("Error checking status.");
                    clearInterval(interval);
                }
            }
        }, 3000);

        // 3. Cleanup: prevent memory leaks
        return () => clearInterval(interval);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        triggerSuccess("Initiating background cache refresh...");
        try {
            await api.post(API_ENDPOINTS.RESET_CACHE);
            triggerSuccess("Refresh task triggered successfully.");
            pollRefreshStatus();
        } catch (error) {
            setIsRefreshing(false);
            setError(error.response?.status === 429 ? "Refresh already in progress." : "Failed to trigger refresh.");
        }
    };

    const handlePurgeDatabase = async () => {
        setIsPurging(true);
        try {
            await api.post(API_ENDPOINTS.PURGE_OLD_PACKAGES);
            triggerSuccess("Orphaned package data purged.");
            setShowPurgeConfirm(false);
        } catch (err) {
            setError("Database purge failed.");
        } finally {
            setIsPurging(false);
        }
    };

    const handleKillTask = async (taskId) => {
        try {
            await api.delete(API_ENDPOINTS.CELERY_STATS, { data: { task_id: taskId } });
            triggerSuccess(`Task ${taskId} killed.`);
            setKillTarget(null);
            fetchStats();
        } catch (err) {
            setError("Failed to terminate task.");
        }
    };

    const handleRunTask = async (taskName) => {
        try {
            await api.post(API_ENDPOINTS.CELERY_STATS, { action: 'run', task_name: taskName });
            triggerSuccess(`Triggered ${taskName}`);
            fetchStats();
        } catch (err) {
            setError("Failed to trigger task.");
        }
    };

    const handleFetchDbStats = async () => {
        setIsLoadingDb(true);
        try {
            const res = await api.get(API_ENDPOINTS.DB_STATS);
            setDbStats(res.data);
        } catch (err) {
            setError("Failed to fetch database stats.");
        } finally {
            setIsLoadingDb(false);
        }
    };

    const handleFetchSystemStats = async () => {
        setIsLoadingSys(true);
        try {
            const res = await api.get(API_ENDPOINTS.SYSTEM_STATS);
            setSysStats(res.data);
        } catch (err) {
            setError("Failed to fetch system stats.");
        } finally {
            setIsLoadingSys(false);
        }
    };

    const handleFetchSystemLogs = async (logType, fileName) => {
        setDownloadingFile(true);
        try {
            const res = await api.get(`${API_ENDPOINTS.SYSTEM_LOGS}${logType}/`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            triggerSuccess(`Downloaded ${fileName}`);
        } catch (err) {
            setError("Failed to download requested log file.");
        } finally {
            setDownloadingFile(false);
        }
    };

    return (
        <div className="bg-gray-800/40 border border-white/5 rounded-2xl p-6 space-y-8">

            {/* Maintenance Section Header */}
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-400" /> Maintenance
            </h3>

            {/* SYSTEM CACHE */}
            <div className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-white/5">
                <div>
                    <p className="text-sm font-medium text-white">System Cache</p>
                    <p className="text-xs text-gray-400 mt-0.5">Force a full reload of server stats.</p>
                </div>
                <button
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase transition-all disabled:opacity-50"
                >
                    {isRefreshing ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Refresh"}
                </button>
            </div>

            {/* DATABASE STATS */}
            <div className="p-4 bg-gray-900/50 rounded-xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-white">Database Statistics</p>
                        <p className="text-xs text-gray-400 mt-0.5">Check health and usage metrics.</p>
                    </div>
                    <button
                        onClick={handleFetchDbStats}
                        disabled={isLoadingDb}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold uppercase transition-all"
                    >
                        {isLoadingDb ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Fetch Stats"}
                    </button>
                </div>

                {/* Expanding Section */}
                {dbStats && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 border-t border-white/5 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-xs">
                                <p className="text-gray-500 uppercase">Engine</p>
                                <p className="text-white font-mono">{dbStats.engine}</p>
                            </div>
                            {Object.entries(dbStats.data || {}).map(([key, value]) => (
                                <div key={key} className="text-xs">
                                    <p className="text-gray-500 uppercase">{key.replace('_', ' ')}</p>
                                    <p className="text-white font-mono">{value}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* SYSTEM STATUS */}
            <div className="p-4 bg-gray-900/50 rounded-xl border border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-white">System Status</p>
                        <p className="text-xs text-gray-400 mt-0.5">Nginx, Gunicorn, Redis, Celery, and Resource health.</p>
                    </div>
                    <button
                        onClick={handleFetchSystemStats}
                        disabled={isLoadingSys}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold uppercase transition-all"
                    >
                        {isLoadingSys ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Check System"}
                    </button>
                </div>

                {sysStats && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300 border-t border-white/5 pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(sysStats.services).map(([name, status]) => (
                                <div key={name} className="flex justify-between text-xs">
                                    <span className="text-gray-500 capitalize">{name}</span>
                                    <span className={status === 'active' ? 'text-green-400' : 'text-red-400'}>{status}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-xs text-gray-300 border-t border-white/5 pt-3 space-y-1">
                            <p>Uptime: <span className="text-white">{sysStats.uptime}</span></p>
                            <p>Disk Usage: <span className="text-white">{sysStats.disk_usage}</span></p>
                            <p>Memory: <span className="text-white">{sysStats.memory}</span></p>
                            <p>Migrations: <span className={sysStats.migrations === 'Up to date' ? 'text-green-400' : 'text-yellow-400'}>{sysStats.migrations}</span></p>
                        </div>
                    </div>
                )}
            </div>

            {/* CELERY STATS & ACTIVE TASKS */}
            <div className="border-t border-white/5 pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <Cpu className="text-indigo-400 w-4 h-4" />
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Worker & Task Health</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5">
                        <p className="text-2xl font-bold text-white">{celeryStats.workers.length}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Online Workers</p>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5">
                        <p className="text-2xl font-bold text-white">{celeryStats.active_tasks?.length || 0}</p>
                        <p className="text-[10px] text-gray-500 uppercase">Active Tasks</p>
                    </div>
                </div>

                {/* Active Tasks List */}
                <div className="bg-gray-900/30 rounded-xl overflow-hidden border border-white/5 mb-6">
                    {celeryStats.active_tasks?.map((task) => (
                        <div key={task.id} className="flex justify-between items-center px-4 py-3 border-b border-white/5 last:border-0">
                            <div>
                                <p className="text-xs text-gray-300 font-bold">{task.name}</p>
                                <p className="text-[9px] text-gray-500 uppercase">Worker: {task.worker}</p>
                            </div>
                            <button
                                onClick={() => setKillTarget(task.id)}
                                className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold"
                            >
                                Kill
                            </button>
                        </div>
                    ))}
                </div>

                {/* Kill Confirmation */}
                {killTarget && (
                    <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl mb-6">
                        <p className="text-xs font-bold text-red-400 text-center mb-3">Terminate task {killTarget.substring(0, 8)}...?</p>
                        <div className="flex gap-2 justify-center">
                            <button onClick={() => setKillTarget(null)} className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400">Cancel</button>
                            <button onClick={() => handleKillTask(killTarget)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase">Confirm</button>
                        </div>
                    </div>
                )}

                {/* Scheduled Tasks List */}
                <div className="mt-6">
                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Scheduled Tasks</h4>
                    <div className="bg-gray-900/30 rounded-xl overflow-hidden border border-white/5 min-h-25 flex flex-col justify-center">
                        {isLoadingTasks ? (
                            <div className="flex flex-col items-center justify-center p-4">
                                <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mb-2" />
                                <p className="text-[10px] text-gray-500 uppercase">Loading tasks...</p>
                            </div>
                        ) : celeryStats.scheduled_tasks.length > 0 ? (
                            celeryStats.scheduled_tasks.map((task, i) => (
                                <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-white/5 last:border-0">
                                    <div>
                                        <p className="text-xs text-gray-300 font-medium">{task.name}</p>
                                        <p className="text-[9px] text-gray-500">
                                            {task.last_run_at ? new Date(task.last_run_at).toLocaleString() : "Never ran"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleRunTask(task.name)}
                                            className="text-indigo-400 hover:text-indigo-300 transition-colors"
                                            title="Run Now"
                                        >
                                            <Play className="w-3 h-3 fill-current" />
                                        </button>
                                        <div className={`w-2 h-2 rounded-full ${task.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-[10px] text-gray-500">No scheduled tasks found.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* SYSTEM LOGS */}
            <div className="border-t border-white/5 pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="text-indigo-400 w-4 h-4" />
                    <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">System Logs</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                        { label: 'General Logs', key: 'astraea_general', file: 'astraea_general.log' },
                        { label: 'Error Logs', key: 'astraea_errors', file: 'astraea_errors.log' },
                        { label: 'Celery Worker', key: 'celery_worker', file: 'celery-worker.log' },
                        { label: 'Celery Beat', key: 'celery_beat', file: 'celery-beat.log' },
                        { label: 'Download All', key: 'all', file: 'astraea_logs.zip' }
                    ].map((log) => (
                        <button
                            key={log.key}
                            onClick={() => handleFetchSystemLogs(log.key, log.file)}
                            disabled={downloadingFile}
                            className="flex items-center justify-between p-3 bg-gray-900/50 hover:bg-gray-900 border border-white/5 rounded-xl transition-all group"
                        >
                            <span className="text-xs text-gray-300 group-hover:text-white">{log.label}</span>
                            <span className="text-[10px] text-indigo-400 font-bold uppercase underline opacity-0 group-hover:opacity-100 transition-opacity">
                                Download
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* DANGER ZONE (Cleaned up look) */}
            <div className="border-t border-white/5 pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <Skull className="text-red-500 w-4 h-4" />
                    <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">Danger Zone</h3>
                </div>

                {!showPurgeConfirm ? (
                    <div className="flex items-center justify-between p-4 bg-red-950/10 border border-red-500/20 rounded-xl">
                        <div>
                            <p className="text-sm font-semibold text-red-200">Purge Orphaned Packages</p>
                            <p className="text-xs text-red-300/60 mt-1 max-w-sm">Permanently delete package definitions not linked to any active server.</p>
                        </div>
                        <button
                            onClick={() => setShowPurgeConfirm(true)}
                            className="px-4 py-2 border border-red-500/30 text-red-500 rounded-lg text-[10px] font-bold uppercase hover:bg-red-500 hover:text-white transition-all"
                        >
                            Purge
                        </button>
                    </div>
                ) : (
                    <div className="p-4 bg-red-600/10 border border-red-500/30 rounded-xl">
                        <p className="text-xs font-bold text-red-400 text-center mb-3 italic">Are you absolutely sure?</p>
                        <div className="flex gap-2 justify-center">
                            <button onClick={() => setShowPurgeConfirm(false)} className="px-4 py-2 text-[10px] font-bold uppercase text-gray-400 hover:text-white">Cancel</button>
                            <button onClick={handlePurgeDatabase} className="px-4 py-2 bg-red-600 text-white rounded-lg text-[10px] font-bold uppercase hover:bg-red-700">
                                {isPurging ? "Purging..." : "Confirm Delete"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServerTools;