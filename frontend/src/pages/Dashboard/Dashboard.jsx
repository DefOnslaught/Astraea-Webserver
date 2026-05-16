import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCircleExclamation,
    faShieldHalved,
    faServer,
    faTriangleExclamation,
    faCirclePause,
    faCircleNotch,
    faCheckDouble,
    faCircleInfo
} from "@fortawesome/free-solid-svg-icons";
import api from "../../utils/api";
import { useAuth } from "../../utils/AuthContext";
import useDocumentTitle from "../../utils/useDocumentTitle";
import { API_ENDPOINTS, PATCH_THRESHOLD_DAYS } from "../../utils/constants";
import ListSkeleton from "./utils/ListSkeleton";
import EmptyState from "./utils/EmptyState";
import ServerRow from "./utils/ServerRow";
import StatCard from "./utils/StatCard";

const Dashboard = () => {
    useDocumentTitle('Dashboard | Astraea');
    const { user, formattedTime } = useAuth();

    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isWarming, setIsWarming] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const fastRetries = useRef(0);
    const slowRetries = useRef(0);

    const fetchDashboardData = async () => {
        try {
            const res = await api.get(API_ENDPOINTS.DASHBOARD);
            if (res.status === 202) {
                setIsWarming(true);
                // Retry after 1 second, cache is warming
                setTimeout(fetchDashboardData, 1000);
            } else {
                setStats(res.data);
                setIsWarming(false);
                setIsLoading(false);
                setError(null);
                fastRetries.current = 0;
                slowRetries.current = 0;
            }
        } catch (err) {
            handleRetry();
        }
    };

    const handleRetry = () => {
        if (fastRetries.current < 5) {
            fastRetries.current += 1;
            setTimeout(fetchDashboardData, 5000);
        } else if (slowRetries.current < 2) {
            slowRetries.current += 1;
            setIsWarming(false); // Stop showing warming if we are in deep retry
            setTimeout(fetchDashboardData, 30000);
        } else {
            // All retries failed
            setIsLoading(false);
            setError("Unable to load infrastructure data. Please check your connection to the Astraea Webserver.");
        }
    };

    useEffect(() => {
        fetchDashboardData();
        // Force a re-render every 60 seconds to update "Today at..." strings
        const interval = setInterval(() => {
            setStats(prev => ({ ...prev }));
        }, 60000);

        return () => clearInterval(interval);
    }, [error]);

    return (
        <div className="animate-in fade-in duration-700 space-y-10">
            {/* ERROR STATE VIEW */}
            {error ? (
                <div className="flex flex-col items-center justify-center py-20 bg-red-500/5 border border-red-500/20 rounded-3xl">
                    <div className="p-4 rounded-full bg-red-500/10 mb-4">
                        <FontAwesomeIcon icon={faCircleExclamation} className="text-3xl text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Connection Failure</h2>
                    <p className="text-gray-400 max-w-md text-center px-6">{error}</p>
                    <button
                        onClick={() => {
                            setError(null);
                            setIsLoading(true);
                            fastRetries.current = 0;
                            slowRetries.current = 0;
                            fetchDashboardData();
                        }}
                        className="mt-6 px-6 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg border border-red-500/30 transition-all"
                    >
                        Force Manual Retry
                    </button>
                </div>
            ) : (
                <>
                    {/* TOP HEADER SECTION */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">
                                Welcome back, <span className="text-indigo-500">{user?.username}</span>
                            </h1>
                            <p className="text-gray-400 mt-1">Here is what's happening with your infrastructure today.</p>
                        </div>

                        {/* SLIM SESSION TIMER */}
                        <div className="bg-gray-800/40 border border-white/5 px-4 py-2 rounded-lg flex items-center gap-3 self-start">
                            <div className="flex flex-col">
                                <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Session Security</span>
                                <span className="text-sm font-mono text-indigo-400">{formattedTime}</span>
                            </div>
                            <div className="h-8 w-px bg-white/5"></div>
                            <FontAwesomeIcon icon={faShieldHalved} className="text-gray-600 text-xs" />
                        </div>
                    </div>

                    {/* STATS GRID */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">

                        {/* CARD 1: TOTAL SERVERS */}
                        <StatCard
                            label="Total Infrastructure"
                            value={stats?.total_servers}
                            icon={faServer}
                            loading={isLoading}
                            color="text-indigo-400"
                            onClick={() => navigate('/servers')}
                        />

                        {/* CARD 2: OUTDATED SERVERS */}
                        <StatCard
                            label="Outdated Servers"
                            value={stats?.outdated_servers}
                            icon={faTriangleExclamation}
                            loading={isLoading}
                            color={stats?.outdated_servers > 0 ? "text-amber-500" : "text-emerald-500"}
                            subtext={stats?.outdated_servers > 0 ? `Not patched in ${PATCH_THRESHOLD_DAYS}+ days` : "All systems current"}
                            onClick={() => navigate(`/servers?q=patched:>${PATCH_THRESHOLD_DAYS}d`)}
                        />

                        {/* CARD 3: DISABLED SERVERS */}
                        <StatCard
                            label="Patching Disabled"
                            value={stats?.total_servers_not_enabled}
                            icon={faCirclePause}
                            loading={isLoading}
                            color={stats?.total_servers_not_enabled > 0 ? "text-slate-400" : "text-emerald-500/50"}
                            subtext="Exempt from automation"
                            glowColor="bg-slate-500/10"
                            onClick={() => navigate('/servers?q=enabled:false')}
                        />

                        {/* CARD 4: SYSTEM STATUS */}
                        <div className={`bg-gray-800/30 border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 ${isLoading ? 'animate-pulse' : ''}`}>
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Cache Status</p>
                                    <h3 className={`text-4xl font-bold tracking-tighter transition-colors duration-500 ${isWarming ? 'text-amber-500' : 'text-emerald-400'}`}>
                                        {isWarming ? "Populating" : "Live"}
                                    </h3>
                                </div>

                                {/* Icon logic matching StatCard hover effects */}
                                <div className={`p-3 rounded-xl bg-white/5 group-hover:scale-110 transition-transform duration-300 ${isWarming ? 'animate-spin' : ''}`}>
                                    <FontAwesomeIcon 
                                        icon={isWarming ? faCircleNotch : faCheckDouble} 
                                        className="text-gray-500 group-hover:text-indigo-400 transition-colors" 
                                    />
                                </div>
                            </div>

                            {!isLoading && (
                                <p className="mt-4 text-xs text-gray-500 font-medium">
                                    Last Refreshed: <span className="text-gray-400 font-mono">
                                        {stats?.last_updated
                                            ? new Intl.DateTimeFormat(navigator.language, {
                                                dateStyle: 'short',
                                                timeStyle: 'medium',
                                            }).format(new Date(stats.last_updated))
                                            : "N/A"}
                                    </span>
                                </p>
                            )}

                            <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-2xl transition-all duration-500 
                        ${isWarming ? 'bg-amber-500/5 group-hover:bg-amber-500/10' : 'bg-emerald-500/5 group-hover:bg-emerald-500/10'}`}>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* AT RISK SERVERS */}
                        <div className="bg-gray-800/20 border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-white/5 bg-red-500/5 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Critical Attention</h2>
                                </div>
                                <span className="text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-1 rounded">Oldest Patch Dates</span>
                            </div>

                            <div className="p-2 grow">
                                {isLoading ? (
                                    <ListSkeleton />
                                ) : stats?.at_risk?.length > 0 ? (
                                    stats.at_risk.map(server => (
                                        <ServerRow key={server.server_id} server={server} type="risk" />
                                    ))
                                ) : (
                                    <EmptyState message="No at-risk servers found." />
                                )}
                            </div>
                        </div>

                        {/* RECENTLY PATCHED */}
                        <div className="bg-gray-800/20 border border-white/5 rounded-2xl overflow-hidden flex flex-col">
                            <div className="p-5 border-b border-white/5 bg-emerald-500/5 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Recently Patched</h2>
                                </div>
                                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-1 rounded">Successfully Patched</span>
                            </div>

                            <div className="p-2 grow">
                                {isLoading ? (
                                    <ListSkeleton />
                                ) : stats?.recent_activity?.length > 0 ? (
                                    stats.recent_activity.map(server => (
                                        <ServerRow key={server.server_id} server={server} type="activity" />
                                    ))
                                ) : (
                                    <EmptyState message="No recent patches recorded." />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* WARMING ALERT */}
                    {isWarming && (
                        <div className="mt-8 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-4 animate-pulse">
                            <FontAwesomeIcon icon={faCircleInfo} className="text-indigo-400" />
                            <p className="text-sm text-indigo-200">
                                The background worker is currently warming the cache. Statistics will update automatically.
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Dashboard;