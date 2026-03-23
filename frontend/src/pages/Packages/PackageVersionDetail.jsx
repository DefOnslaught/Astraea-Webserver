import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";
import TableSkeleton from "./utils/TableSkeleton";

const PackageVersionDetail = () => {
    const { packageName } = useParams();
    const [searchParams] = useSearchParams();
    const version = searchParams.get('v');
    const navigate = useNavigate();

    const [servers, setServers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [nextPageUrl, setNextPageUrl] = useState(null);
    const [totalCount, setTotalCount] = useState(0);

    const fetchServers = useCallback(async (isLoadMore = false) => {
        if (isLoading || (isLoadMore && !nextPageUrl)) return;

        setIsLoading(true);
        try {
            const url = isLoadMore ? nextPageUrl : API_ENDPOINTS.PACKAGE_SERVER_LIST;
            const res = await api.get(url, {
                params: isLoadMore ? {} : { name: packageName, version: version }
            });

            setServers(prev => isLoadMore ? [...prev, ...res.data.results] : res.data.results);
            setNextPageUrl(res.data.next);
            setTotalCount(res.data.count);
        } catch (err) {
            console.error("Failed to fetch instances", err);
        } finally {
            setIsLoading(false);
        }
    }, [packageName, version, nextPageUrl, isLoading]);

    // Intersection Observer logic
    const observer = useRef();
    const lastElementRef = useCallback(node => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && nextPageUrl) {
                fetchServers(true);
            }
        });
        if (node) observer.current.observe(node);
    }, [isLoading, nextPageUrl, fetchServers]);

    useEffect(() => {
        fetchServers();
    }, [packageName, version]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header with Breadcrumbs */}
            <div className="flex items-center justify-between">
                <div>
                    <button onClick={() => navigate(-1)} className="text-indigo-400 hover:text-indigo-300 text-sm mb-2 flex items-center gap-2">
                        <i className="fa-solid fa-arrow-left"></i> Back to Catalog
                    </button>
                    <h1 className="text-3xl font-bold text-white">
                        {packageName} <span className="text-indigo-500 text-xl font-mono">v{version}</span>
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Showing <span className="text-white font-bold">{servers.length}</span> of <span className="text-indigo-400 font-bold">{totalCount}</span> detected instances.
                    </p>
                </div>
            </div>

            {/* Grid of Server Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {servers.map((server, index) => (
                    <div
                        key={`${server.server_id}-${index}`}
                        ref={servers.length === index + 1 ? lastElementRef : null}
                        onClick={() => navigate(`/inspect/${server.server_id}/`)}
                        className="group relative p-5 rounded-2xl bg-gray-800/30 border border-white/5 hover:border-indigo-500/50 cursor-pointer transition-all"
                    >
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    <i className="fa-solid fa-server text-xs"></i>
                                </div>
                                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${server.last_patch_status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                    {server.last_patch_status}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-white font-bold truncate">{server.hostname}</h3>
                                <p className="text-[10px] text-gray-500 font-mono mt-1 uppercase tracking-tighter">{server.os_version}</p>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Loading State for Infinite Scroll */}
                {isLoading && (
                    <div className="col-span-full flex justify-center py-10">
                        <i className="fa-solid fa-circle-notch animate-spin text-indigo-500 text-2xl"></i>
                    </div>
                )}
            </div>

            {servers.length === 0 && !isLoading && (
                <div className="text-center py-20 bg-gray-800/10 rounded-3xl border border-dashed border-white/10">
                    <i className="fa-solid fa-box-open text-4xl text-gray-700 mb-4"></i>
                    <p className="text-gray-500">No active instances found for this version.</p>
                </div>
            )}
        </div>
    );
};

export default PackageVersionDetail;