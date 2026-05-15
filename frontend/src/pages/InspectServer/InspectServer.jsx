import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from "react-router-dom";
import api from '../../utils/api';
import { API_ENDPOINTS } from "../../utils/constants";
import ConfigureServerModal from '../Servers/utils/ConfigureServerModal';
import useDocumentTitle from "../../utils/useDocumentTitle";
import SuccessToast from '../../components/SuccessToast';
import SectionLoader from '../../components/SectionLoader';
import PackageList from './utils/PackageList';
import SessionDetailsModal from './utils/modals/SessionDetailModal';
import HistoryTable from './utils/HistoryTable';
import {
    Server, Shield, Globe, Cpu, Cog, X, Loader2,
    ChevronLeft, Package, Clock, AlertTriangle, Search,
    CalendarDays
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatCard icon={<Cpu className="text-blue-400" />} label="OS Version" value={serverInfo.os_version} />
                <StatCard icon={<Clock className="text-orange-400" />} label="Uptime" value={serverInfo.uptime} />
                <StatCard icon={<Shield className="text-purple-400" />} label="Last Patch" value={serverInfo.last_patch ? new Date(serverInfo.last_patch).toLocaleDateString() : 'Never'} />
                <StatCard icon={<Globe className="text-emerald-400" />} label="Environment" value={serverInfo.env} />
                <StatCard icon={<CalendarDays className="text-orange-400" />} label="Date Registered" value={serverInfo.date_registered ? new Date(serverInfo.date_registered).toLocaleDateString() : 'Unknown'} />
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