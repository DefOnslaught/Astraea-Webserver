import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from "react-router-dom";
import api from '../../utils/api';
import { API_ENDPOINTS } from "../../utils/constants";
import ConfigureServerModal from '../Servers/utils/ConfigureServerModal';
import useDocumentTitle from "../../utils/useDocumentTitle";
import SuccessToast from '../../components/SuccessToast';
import SectionLoader from '../../components/SectionLoader';
import PackageList from './utils/PackageList';
import SessionDetailsModal from './utils/modals/SessionDetailModal';
import ErrorLogModal from './utils/modals/ErrorLogModal';
import HistoryTable from './utils/HistoryTable';
import HistorySearchGuide from './utils/HistorySearchGuide';
import {
    Server, Shield, Globe, Cpu, Cog, X, Loader2,
    ChevronLeft, Package, Clock, AlertTriangle, Search,
    CalendarDays, RotateCcw
} from 'lucide-react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faMagnifyingGlass,
    faCircleInfo,
} from "@fortawesome/free-solid-svg-icons";

const InspectServer = () => {
    const { server_id } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [serverInfo, setServerInfo] = useState(null);
    const [history, setHistory] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState("");
    const [historyOffset, setHistoryOffset] = useState(5);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const [isHistoryLoadingMore, setIsHistoryLoadingMore] = useState(false);
    const [isHistoryInfinite, setIsHistoryInfinite] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [packages, setPackages] = useState([]);
    const [isPackagesLoading, setIsPackagesLoading] = useState(true);
    const [packagesError, setPackagesError] = useState("");
    const [error, setError] = useState("");
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [selectedSession, setSelectedSession] = useState(null);
    const [showErrorLog, setShowErrorLog] = useState(null);
    const [sessionTimestamp, setSessionTimestamp] = useState(null);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const searchContainerRef = useRef(null);
    const navigate = useNavigate();

    useDocumentTitle(serverInfo ? `${serverInfo.hostname} | Astraea` : 'Loading | Astraea');

    const fetchServer = async () => {
        try {
            const res = await api.get(`${API_ENDPOINTS.INSPECT_SERVER}?server_id=${server_id}`);
            setServerInfo(res.data);
            setHistory(res.data.recent_history || []);
            setHasMoreHistory(res.data.has_more_history ?? false);
            if (res.data.recent_packages) setPackages(res.data.recent_packages);
        } catch (err) {
            setError("Critical: Could not connect to Astraea backend.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFullHistory = async (isFirstLoadMore = false, reset = false, query = searchQuery) => {
        if (!reset && (!hasMoreHistory || isHistoryLoadingMore)) return;

        if (!reset) setIsHistoryLoadingMore(true);
        const limit = (reset && !query) ? 5 : 10;
        const currentOffset = reset ? 0 : historyOffset;

        try {
            let url = `${API_ENDPOINTS.SERVER_HISTORY}?server_id=${server_id}&limit=${limit}&offset=${currentOffset}`;
            if (query) {
                url += `&search=${encodeURIComponent(query)}`;
            }

            const res = await api.get(url);

            if (res.data && res.data.length > 0) {
                setHistory(prev => {
                    if (reset) return res.data;
                    const existingIds = new Set(prev.map(item => item.id));
                    const uniqueNewItems = res.data.filter(item => !existingIds.has(item.id));
                    return [...prev, ...uniqueNewItems];
                });

                setHistoryOffset(currentOffset + res.data.length);

                if (res.data.length < limit) {
                    setHasMoreHistory(false);
                } else {
                    setHasMoreHistory(true);
                }
            } else {
                if (reset) setHistory([]);
                setHasMoreHistory(false);
            }

            if (isFirstLoadMore) {
                setIsHistoryInfinite(true);
            }

            setHistoryError("");
        } catch (error) {
            setHistoryError("Critical: Could not synchronize history with Astraea engine.");
        } finally {
            setIsHistoryLoading(false);
            setIsHistoryLoadingMore(false);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setIsGuideOpen(false);
        setIsHistoryLoading(true);
        fetchFullHistory(false, true, searchQuery);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setIsHistoryLoading(true);
        setIsHistoryInfinite(false);
        fetchFullHistory(false, true, '');
        setIsGuideOpen(false);
    };

    const fetchPackages = async () => {
        if (packages.length > 0) return;

        try {
            const res = await api.get(`${API_ENDPOINTS.SERVER_PACKAGES}?server_id=${server_id}`);
            setPackages(res.data);
        } catch (error) {
            setPackagesError("Critical: Could not connect to Astraea backend.");
        } finally {
            setIsPackagesLoading(false);
        }
    };

    const handleSuccess = (data) => {
        if (data?.isDeleted) {
            navigate('/servers');
            return;
        }
        fetchServer();
        setIsConfigOpen(false);
        setSuccessMsg(`Updated ${serverInfo.hostname} successfully!`);
        setShowSuccess(true);
    }

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'history') {
            setIsHistoryLoading(false);
        }
    };

    const handleShowingErrorLog = (errorLog, timestamp) => {
        setShowErrorLog(errorLog);
        setSessionTimestamp(timestamp);
    };

    useEffect(() => { fetchServer(); }, [server_id]);

    useEffect(() => {
        const handleEvents = (event) => {
            if (isGuideOpen && searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsGuideOpen(false);
            }
            if (event.key === 'Escape') {
                setIsGuideOpen(false);
            }
        };

        if (isGuideOpen) {
            document.addEventListener("mousedown", handleEvents);
            document.addEventListener("keydown", handleEvents);
        }
        return () => {
            document.removeEventListener("mousedown", handleEvents);
            document.removeEventListener("keydown", handleEvents);
        };
    }, [isGuideOpen]);

    if (isLoading) return <InspectSkeleton />;
    if (error) return <div className="p-10 text-red-500 flex items-center gap-2"><AlertTriangle /> {error}</div>;

    return (
        <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-500">
            {showSuccess && <SuccessToast message={successMsg} onClose={() => setShowSuccess(false)} />}
            {/* Header Section */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-700">
                <div className="flex items-center gap-4">
                    <Link to="/servers" className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                        <ChevronLeft className="w-6 h-6" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                            {serverInfo.hostname}
                            <span className={`text-xs px-2 py-1 rounded ${serverInfo.enable_patching ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {serverInfo.enable_patching ? 'Patching Active' : 'Patching Disabled'}
                            </span>
                            {serverInfo.was_rebooted ? (
                                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">
                                    <RotateCcw className="w-3 h-3" /> Rebooted Last Patch
                                </span>
                            ) : (
                                <span className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-400 flex items-center gap-1">
                                    <RotateCcw className="w-3 h-3" /> No Reboot Required
                                </span>
                            )}
                            {!serverInfo.enable_notifications && (
                                <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                                    Notifications Disabled
                                </span>
                            )}
                            {!serverInfo.enable_zabbix && (
                                <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400">
                                    Zabbix Disabled
                                </span>
                            )}
                        </h1>
                        <p className="text-slate-400 font-mono text-sm">{serverInfo.server_id}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => { setIsConfigOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg shadow-indigo-500/20">
                        <Cog className="w-4 h-4" /> Configure
                    </button>
                </div>
            </div>

            {/* Top Level Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatCard icon={<Cpu className="text-blue-400" />} label="OS Version" value={serverInfo.os_version} />
                <StatCard icon={<Clock className="text-orange-400" />} label="Last Known Uptime" value={serverInfo.uptime} />
                <StatCard icon={<Shield className="text-purple-400" />} label="Last Patch" value={serverInfo.last_patch ? new Date(serverInfo.last_patch).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }) : 'Never'} />
                <StatCard icon={<Globe className="text-emerald-400" />} label="Environment" value={serverInfo.env} />
                <StatCard icon={<CalendarDays className="text-orange-400" />} label="Date Registered" value={serverInfo.date_registered ? new Date(serverInfo.date_registered).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                }) : 'Unknown'} />
            </div>

            {/* Main Content Tabs */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex border-b border-slate-800 bg-slate-900/80">
                    <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" icon={<Server className="w-4 h-4" />} />
                    <TabBtn active={activeTab === 'history'} onClick={() => handleTabChange('history')} label="Patch History" icon={<Clock className="w-4 h-4" />} />
                    <TabBtn active={activeTab === 'packages'} onClick={() => { setActiveTab('packages'); fetchPackages(); }} label="Packages" icon={<Package className="w-4 h-4" />} />
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <section>
                                <h3 className="text-lg font-semibold mb-4 text-slate-200">Network Interfaces</h3>
                                <div className="space-y-3">
                                    {serverInfo.interfaces.map(iface => (
                                        <div key={iface.mac} className="p-4 bg-slate-800/40 rounded-lg border border-slate-700/50 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-indigo-400">{iface.name}</p>
                                                <p className="text-xs text-slate-500 font-mono">{iface.mac}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-slate-200 font-mono">{iface.ip}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 text-slate-200">Agent Configuration</h3>
                                    <div className="bg-slate-800/20 p-4 rounded-lg border border-slate-700">
                                        <div className="flex justify-between mb-4">
                                            <span className="text-slate-400">Schedule</span>
                                            <span className="text-slate-100 font-medium">{serverInfo.patch_schedule}</span>
                                        </div>

                                        <div className="flex justify-between mb-4">
                                            <span className="text-slate-400">Disable Autoremove</span>
                                            <span className={`font-medium ${serverInfo.disable_autoremove ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {serverInfo.disable_autoremove ? "Enabled" : "Disabled"}
                                            </span>
                                        </div>

                                        <div className="flex justify-between mb-4">
                                            <span className="text-slate-400">Enable APT Release Info Change</span>
                                            <span className={`font-medium ${serverInfo.enable_apt_release_info_change ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {serverInfo.enable_apt_release_info_change ? "Enabled" : "Disabled"}
                                            </span>
                                        </div>

                                        <div className="flex justify-between mb-4">
                                            <span className="text-slate-400">Reboot On Success</span>
                                            <span className={`font-medium ${serverInfo.reboot_on_success ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {serverInfo.reboot_on_success ? "Enabled" : "Disabled"}
                                            </span>
                                        </div>

                                        <div className="flex justify-between mb-4">
                                            <span className="text-slate-400">Reboot After Updates</span>
                                            <span className={`font-medium ${serverInfo.reboot_after_updates ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {serverInfo.reboot_after_updates ? "Enabled" : "Disabled"}
                                            </span>
                                        </div>

                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Max Allowed Uptime</span>
                                            <span className="text-indigo-400 font-medium">{serverInfo.max_allowed_uptime} Days</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            <div className="relative w-full md:w-96">
                                <form onSubmit={handleSearchSubmit} className="relative group" ref={searchContainerRef}>
                                    <FontAwesomeIcon
                                        icon={faMagnifyingGlass}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors"
                                    />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search patch history, logs, or status..."
                                        className="w-full bg-gray-800/40 border border-white/5 rounded-xl py-3 pl-12 pr-20 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-gray-600"
                                    />

                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                        {searchQuery && (
                                            <button type="button" onClick={clearSearch} className="text-slate-400 hover:text-slate-200 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setIsGuideOpen(!isGuideOpen)}
                                            className={`text-gray-500 hover:text-indigo-400 transition-colors ${isGuideOpen ? 'text-indigo-400' : ''}`}
                                        >
                                            <FontAwesomeIcon icon={faCircleInfo} />
                                        </button>
                                    </div>
                                </form>

                                <HistorySearchGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
                            </div>
                            <HistorySearchGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />

                            <HistoryTable
                                history={history}
                                onSelectSession={setSelectedSession}
                                error={historyError}
                                loading={isHistoryLoading}
                                loadingMore={isHistoryLoadingMore}
                                hasMore={hasMoreHistory}
                                isInfinite={isHistoryInfinite}
                                loadMore={fetchFullHistory}
                                searchQuery={searchQuery}
                                onHandleShowingErrorLog={handleShowingErrorLog}
                            />
                        </div>
                    )}
                    {activeTab === 'packages' && <PackageList packages={packages} error={packagesError} loading={isPackagesLoading} />}
                </div>
            </div>
            {/* RENDER MODAL */}
            {isConfigOpen && (
                <ConfigureServerModal
                    server_id={server_id}
                    onClose={() => setIsConfigOpen(false)}
                    onUpdateSuccess={handleSuccess}
                />
            )}
            {selectedSession && (
                <SessionDetailsModal
                    session={selectedSession}
                    onClose={() => setSelectedSession(null)}
                />
            )}
            {showErrorLog && (
                <ErrorLogModal
                    errorLog={showErrorLog}
                    sessionTimestamp={sessionTimestamp}
                    onClose={() => handleShowingErrorLog(null, null)}
                />
            )}
        </div>
    );
};

const StatCard = ({ icon, label, value }) => (
    <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
        <div className="p-3 bg-slate-800 rounded-lg">{icon}</div>
        <div>
            <p className="text-slate-500 text-xs uppercase tracking-wider font-bold">{label}</p>
            <p className="text-white font-medium">{value || 'N/A'}</p>
        </div>
    </div>
);

const TabBtn = ({ active, onClick, label, icon }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all border-b-2 ${active ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
    >
        {icon} {label}
    </button>
);

const InspectSkeleton = () => (
    <div className="max-w-7xl mx-auto p-6 space-y-6 animate-pulse">
        <div className="h-12 bg-slate-800 w-1/3 rounded"></div>
        <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-xl"></div>)}
        </div>
        <div className="h-96 bg-slate-800 rounded-xl"></div>
    </div>
);

export default InspectServer;