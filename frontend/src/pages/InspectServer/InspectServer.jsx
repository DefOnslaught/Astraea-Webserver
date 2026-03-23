import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from "react-router-dom";
import api from '../../utils/api';
import { API_ENDPOINTS } from "../../utils/constants";
import ConfigureServerModal from '../Servers/utils/ConfigureServerModal';
import useDocumentTitle from "../../utils/useDocumentTitle";
import SuccessToast from '../../components/SuccessToast';
import SectionLoader from '../../components/SectionLoader';
import {
    Server, Shield, Globe, Cpu, Cog, X, Loader2,
    ChevronLeft, Package, Clock, AlertTriangle, Search
} from 'lucide-react';

const InspectServer = () => {
    const { server_id } = useParams();
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [serverInfo, setServerInfo] = useState(null);
    const [history, setHistory] = useState([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [historyError, setHistoryError] = useState("");
    const [packages, setPackages] = useState([]);
    const [isPackagesLoading, setIsPackagesLoading] = useState(true);
    const [packagesError, setPackagesError] = useState("");
    const [error, setError] = useState("");
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [successMsg, setSuccessMsg] = useState("");
    const [selectedSession, setSelectedSession] = useState(null);
    const navigate = useNavigate();

    useDocumentTitle(serverInfo ? `${serverInfo.hostname} | Astraea` : 'Loading | Astraea');

    const fetchServer = async () => {
        try {
            const res = await api.get(`${API_ENDPOINTS.INSPECT_SERVER}?server_id=${server_id}`);
            setServerInfo(res.data);
            if (res.data.recent_history) setHistory(res.data.recent_history);
            if (res.data.recent_packages) setPackages(res.data.recent_packages);
        } catch (err) {
            setError("Critical: Could not connect to Astraea backend.");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchFullHistory = async () => {
        if (history.length > 0) return;

        try {
            const res = await api.get(`${API_ENDPOINTS.SERVER_HISTORY}?server_id=${server_id}`);
            setHistory(res.data);
        } catch (error) {
            setHistoryError("Critical: Could not connect to Astraea backend.");
        } finally {
            setIsHistoryLoading(false);
        }
    };

    const fetchPackages = async () => {
        if (history.length > 0) return;

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

    useEffect(() => { fetchServer(); }, [server_id]);

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
                        </h1>
                        <p className="text-slate-400 font-mono text-sm">{serverInfo.server_id}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => {setIsConfigOpen(true);}} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg shadow-indigo-500/20">
                        <Cog className="w-4 h-4" /> Configure
                    </button>
                </div>
            </div>

            {/* Top Level Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard icon={<Cpu className="text-blue-400" />} label="OS Version" value={serverInfo.os_version} />
                <StatCard icon={<Clock className="text-orange-400" />} label="Uptime" value={serverInfo.uptime} />
                <StatCard icon={<Shield className="text-purple-400" />} label="Last Patch" value={serverInfo.last_patch ? new Date(serverInfo.last_patch).toLocaleDateString() : 'Never'} />
                <StatCard icon={<Globe className="text-emerald-400" />} label="Environment" value={serverInfo.env} />
            </div>

            {/* Main Content Tabs */}
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex border-b border-slate-800 bg-slate-900/80">
                    <TabBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" icon={<Server className="w-4 h-4" />} />
                    <TabBtn active={activeTab === 'history'} onClick={() => { setActiveTab('history'); fetchFullHistory(); }} label="Patch History" icon={<Clock className="w-4 h-4" />} />
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
                                    <h3 className="text-lg font-semibold mb-4 text-slate-200">Patch Configuration</h3>
                                    <div className="bg-slate-800/20 p-4 rounded-lg border border-slate-700">
                                        <div className="flex justify-between mb-4">
                                            <span className="text-slate-400">Schedule</span>
                                            <span className="text-slate-100 font-medium">{serverInfo.patch_schedule}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Packages Updated Last Patch</span>
                                            <span className="text-indigo-400 font-bold">{serverInfo.total_packages_updated}</span>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'history' && <HistoryTable history={history} onSelectSession={setSelectedSession} error={historyError} loading={isHistoryLoading} />}
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
        </div>
    );
};

// Sub-components for cleaner code
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

const HistoryTable = ({ history, onSelectSession, error, loading }) => {
    if (!Array.isArray(history)) return <div className="p-4 text-slate-500 italic">No history available.</div>;

    if (history.length === 0 && loading) return <div className="max-h-100 text-slate-500 italic"><SectionLoader label='Loading Patch History' /></div>;

    if (history.length === 0 && error) return <div className="p-10 text-red-500 flex items-center gap-2"><AlertTriangle />{error}</div>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="text-slate-500 text-sm uppercase">
                    <tr>
                        <th className="pb-4">Timestamp</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4">Updated</th>
                        <th className="pb-4">Logs / Errors</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">

                    {history.map(session => (
                        <tr key={session.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="py-4 text-slate-300 font-mono text-sm">
                                <button
                                    onClick={() => onSelectSession(session)}
                                    className="hover:text-indigo-400 hover:underline decoration-indigo-500/50 transition-colors text-left"
                                >
                                    {new Date(session.timestamp).toLocaleString('en-GB', {
                                        dateStyle: 'medium',
                                        timeStyle: 'short'
                                    })}
                                </button>
                            </td>
                            <td className="py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-bold ${session.status === 'success'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${session.status === 'success' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                    {session.status.toUpperCase()}
                                </span>
                            </td>
                            <td className="py-4 text-slate-300">
                                <span className="font-bold text-indigo-400">{session.total}</span> pkgs
                            </td>
                            <td className="py-4">
                                {session.error_log ? (
                                    <button
                                        onClick={() => onSelectSession(session)}
                                        className="text-xs text-red-400 hover:text-red-300 underline underline-offset-4"
                                    >
                                        View Error Log
                                    </button>
                                ) : (
                                    <span className="text-slate-600 text-xs italic">Clean Run</span>
                                )}
                            </td>
                        </tr>
                    ))}
                    

                    {!loading && history.length === 0 && !error && (
                        <tr>
                            <td colSpan="6" className="py-20 text-center">
                                <i className="fa-solid fa-box-open text-4xl text-gray-700 mb-4 block"></i>
                                <p className="text-gray-500">No Patch History to show.</p>
                            </td>
                        </tr>
                    )}
                    
                </tbody>
            </table>
        </div>
    );
};

const SessionDetailsModal = ({ session, onClose }) => {
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);

    // Helper to determine version direction
    const getVersionStatus = (oldVer, newVer) => {
        if (!oldVer || oldVer === '0.0.0') return { color: 'text-emerald-400', label: 'New' };

        // Simple natural sort comparison
        // Note: For complex OS versions (like debian/ubuntu), 
        // a more robust regex-based sorter is better, but this works for most.
        if (newVer.localeCompare(oldVer, undefined, { numeric: true }) < 0) {
            return { color: 'text-orange-400', label: 'Downgrade' };
        }
        return { color: 'text-emerald-400', label: 'Upgrade' };
    };

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await api.get(`${API_ENDPOINTS.SESSION_DETAILS}?session_id=${session.id}`);
                setDetails(res.data);
            } catch (err) {
                console.error("Failed to load session details");
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [session.id]);

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Clock className="w-5 h-5 text-indigo-400" />
                            Session Details
                        </h2>
                        <p className="text-sm text-slate-500 font-mono mt-1">
                            {new Date(session.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
                            <p>Loading update manifest...</p>
                        </div>
                    ) : (
                        <>
                            {/* Error Log Section */}
                            {details.error_log && (
                                <div className="space-y-2">
                                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" /> Error Log Output
                                    </h3>
                                    <pre className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg text-xs text-red-200 font-mono overflow-x-auto whitespace-pre-wrap">
                                        {details.error_log}
                                    </pre>
                                </div>
                            )}

                            {/* Package Diffs */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                                    Modified Packages ({details.updates.length})
                                </h3>
                                <div className="grid gap-2">
                                    {details.updates.map((upd, i) => {
                                        const status = getVersionStatus(upd.old_version, upd.new_version);
                                        return (
                                            <div key={i} className="flex items-center justify-between p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg group hover:border-slate-600 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-200 font-medium">{upd.name}</span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 font-mono text-xs">
                                                    <span className="text-slate-500 line-through decoration-slate-700">
                                                        {upd.old_version || '0.0.0'}
                                                    </span>
                                                    <ChevronLeft className="w-3 h-3 text-slate-600 rotate-180" />
                                                    <span className={`${status.color} font-bold bg-slate-950 px-2 py-1 rounded`}>
                                                        {upd.new_version}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {details.updates.length === 0 && (
                                        <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-xl text-slate-500 italic">
                                            No packages were changed in this session.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const PackageList = ({ packages, error, loading }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedTerm, setDebouncedTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        setIsSearching(true);
        const handler = setTimeout(() => {
            setDebouncedTerm(searchTerm);
            setIsSearching(false);
        }, 300); // 300ms delay is the "sweet spot" for human typing

        // Cleanup: cancels the timer if the user types again before 300ms
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const filteredPackages = useMemo(() => {
        if (!Array.isArray(packages)) return [];
        const query = debouncedTerm.toLowerCase().trim();

        return packages.filter(pkg => {
            const name = pkg?.name?.toLowerCase() || "";
            const version = pkg?.version?.toLowerCase() || "";
            return name.includes(query) || version.includes(query);
        });
    }, [debouncedTerm, packages]);

    if (!Array.isArray(packages) || packages.length === 0) {
        return (
            <div className="p-10 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p>No package inventory available for this server.</p>
            </div>
        );
    }

    if (packages.length === 0 && loading) return <div className="max-h-100 text-slate-500 italic"><SectionLoader label='Loading Packages' /></div>;

    if (error) return <div className="p-10 text-red-500 flex items-center gap-2"><AlertTriangle />{error}</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Search Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-md group">
                    {/* Visual cue: Show a spinner if searching/filtering is pending */}
                    {isSearching ? (
                        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
                    ) : (
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    )}

                    <input
                        type="text"
                        value={searchTerm}
                        placeholder="Search by name or version..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-10 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-700 rounded-md text-slate-400"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div className="text-xs text-slate-500 font-medium bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
                    Showing {filteredPackages.length} of {packages.length}
                </div>
            </div>

            {/* Package Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredPackages.length > 0 ? (
                    filteredPackages.map((pkg, idx) => (
                        <div key={`${pkg.name}-${pkg.version}-${idx}`} className="p-4 bg-slate-800/30 border border-slate-700/50 rounded-xl flex flex-col hover:border-indigo-500/50 hover:bg-slate-800/60 transition-all group">
                            <div className="flex justify-between items-start gap-2">
                                <span className="text-slate-200 font-medium group-hover:text-white transition-colors break-all">
                                    {pkg.name}
                                </span>
                                <span className="shrink-0 text-indigo-300 font-mono text-[11px] bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                    v{pkg.version}
                                </span>
                            </div>

                            {pkg.last_seen && (
                                <div className="pt-3 flex items-center gap-2 border-t border-slate-700/50 mt-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">
                                        Observed {new Date(pkg.last_seen).toLocaleDateString()}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-2xl">
                        <p>No matches found</p>
                    </div>
                )}
            </div>
        </div>
    );
};

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