import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../../utils/constants";
import api from "../../utils/api";
import useDocumentTitle from "../../utils/useDocumentTitle";
import TableSkeleton from "./utils/TableSkeleton";
import PackageRow from "./utils/PackageRow";

const Packages = () => {
    useDocumentTitle('Packages | Astraea');

    const [isLoading, setIsLoading] = useState(false);
    const [packages, setPackages] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [nextPageUrl, setNextPageUrl] = useState(null);
    const [totalCount, setTotalCount] = useState(0);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const searchInputRef = useRef(null);

    const fetchPackages = useCallback(async (query = "", isLoadMore = false) => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const url = isLoadMore ? nextPageUrl : API_ENDPOINTS.PACKAGE_SEARCH;
            const res = await api.get(url, { params: isLoadMore ? {} : { q: query } });
            const newPackages = res.data.results || [];
            setPackages(prev => isLoadMore ? [...prev, ...newPackages] : newPackages);
            setNextPageUrl(res.data.next);
            setTotalCount(res.data.count || 0);
            if (!isLoadMore) setActiveQuery(query);
        } catch (err) { console.error(err); } 
        finally { setIsLoading(false); }
    }, [nextPageUrl, isLoading]);

    // Intersection Observer for Endless Scroll
    const observer = useRef();
    const lastElementRef = useCallback(node => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && nextPageUrl) {
                fetchPackages(activeQuery, true);
            }
        });

        if (node) observer.current.observe(node);
    }, [isLoading, nextPageUrl, activeQuery, fetchPackages]);

    useEffect(() => {
        fetchPackages();
    }, []);

    // Scroll to top and Key listener logic
    useEffect(() => {
        const handleScroll = () => setShowScrollTop(window.scrollY > 400);
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
            if (e.key === '/' || e.key === 's') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener("scroll", handleScroll);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener("scroll", handleScroll);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setNextPageUrl(null);
        fetchPackages(searchQuery);
    };

    const clearSearch = () => {
        setSearchQuery("");
        setNextPageUrl(null);
        fetchPackages("");
    };

    return (
        <div className="animate-in fade-in duration-700 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Software <span className="text-indigo-500">Catalog</span></h1>
                    <p className="text-gray-400 mt-1">
                        Monitoring <span className="text-indigo-400 font-bold">{totalCount}</span> unique software packages.
                    </p>
                </div>

                <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96 group">
                    <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400"></i>
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search package name (e.g. nginx)..."
                        className="w-full bg-gray-800/40 border border-white/5 rounded-xl py-3 pl-12 pr-12 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-gray-600"
                    />
                    {(searchQuery || activeQuery) && (
                        <button onClick={clearSearch} type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400">
                            <i className="fa-solid fa-circle-xmark"></i>
                        </button>
                    )}
                </form>
            </div>

            <div className="bg-gray-800/20 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-gray-400 font-bold border-b border-white/5">
                                <th className="px-6 py-4 w-10"></th>
                                <th className="px-6 py-4">Package Name</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Total Instances</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {packages.length === 0 && isLoading ? (
                                <TableSkeleton />
                            ) : (
                                packages.map((pkg, index) => (
                                    <PackageRow
                                        key={pkg.name}
                                        pkg={pkg}
                                        innerRef={packages.length === index + 1 ? lastElementRef : null}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className={`fixed bottom-8 right-8 p-4 rounded-xl bg-indigo-500 text-white transition-all ${showScrollTop ? 'opacity-100' : 'opacity-0'}`}
            >
                <i className="fa-solid fa-arrow-up"></i>
            </button>
        </div>
    );
};

export default Packages;