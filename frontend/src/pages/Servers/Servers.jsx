import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { API_ENDPOINTS } from "../../utils/constants";
import api from "../../utils/api";
import useDocumentTitle from "../../utils/useDocumentTitle";
import SearchGuide from "./utils/SearchGuide";
import TableSkeleton from "./utils/TableSkeleton";
import ServerRow from "./utils/ServerRow";

const Servers = () => {
    useDocumentTitle('Servers | Astraea');

    const [isLoading, setIsLoading] = useState(false);
    const [servers, setServers] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [nextPageUrl, setNextPageUrl] = useState(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const searchContainerRef = useRef(null);
    const searchInputRef = useRef(null);
    const [totalNodes, setTotalNodes] = useState(0);


    const fetchServers = useCallback(async (query = "", isLoadMore = false) => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            // If loading more, use the 'next' URL from pagination; otherwise start fresh
            const url = isLoadMore ? nextPageUrl : API_ENDPOINTS.SERVER_SEARCH;
            const res = await api.get(url, {
                params: isLoadMore ? {} : { q: query }
            });

            setTotalNodes(res.data.count || 0);
            const newServers = res.data.results || [];
            setServers(prev => isLoadMore ? [...prev, ...newServers] : newServers);
            setNextPageUrl(res.data.next);
            if (!isLoadMore) setActiveQuery(query);
        } catch (err) {
            console.error("Fetch error:", err);
        } finally {
            setIsLoading(false);
        }
    }, [nextPageUrl, isLoading]);


    const observer = useRef();
    const lastElementRef = useCallback(node => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && nextPageUrl) {
                fetchServers(activeQuery, true);
            }
        });

        if (node) observer.current.observe(node);
    }, [isLoading, nextPageUrl, activeQuery, fetchServers]);


    useEffect(() => {
        fetchServers();
    }, []);


    useEffect(() => {
        const handleScroll = () => {
            // Show button if user scrolls down more than 400px
            if (window.scrollY > 400) {
                setShowScrollTop(true);
            } else {
                setShowScrollTop(false);
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const handleEvents = (event) => {
            // Handle Click Outside
            if (isGuideOpen && searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsGuideOpen(false);
            }
            // Handle Escape Key
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


    // Focus search bar when user types '/' or 's' 
    useEffect(() => {
        const handleKeyDown = (event) => {
            const isTyping =
                event.target.tagName === 'INPUT' ||
                event.target.tagName === 'TEXTAREA' ||
                event.target.isContentEditable;

            if (isTyping) return;

            if (event.key === '/' || event.key === 's') {
                event.preventDefault();
                searchInputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);


    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: "smooth",
        });
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        setNextPageUrl(null);
        fetchServers(searchQuery);
        setIsGuideOpen(false);
    };

    const clearSearch = () => {
        setSearchQuery("");
        setNextPageUrl(null);
        if (activeQuery) {
            fetchServers("");
        }
        setIsGuideOpen(false);
    };

    return (
        <div className="animate-in fade-in duration-700 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Infrastructure <span className="text-indigo-500">Inventory</span></h1>
                    <p className="text-gray-400 mt-1">
                        Showing <span className="text-white font-medium">{servers.length}</span> of{" "}
                        <span className="text-indigo-400 font-bold">{totalNodes}</span> total nodes.
                    </p>
                </div>

                <div className="relative" ref={searchContainerRef}> {/* Container for search + guide */}
                    <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96 group">
                        <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-400 transition-colors"></i>
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search host:web os:linux..."
                            className="w-full bg-gray-800/40 border border-white/5 rounded-xl py-3 pl-12 pr-12 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all placeholder:text-gray-600"
                        />

                        {(searchQuery || activeQuery) && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-10 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-400 transition-all p-1 animate-in fade-in zoom-in duration-200"
                                title="Clear Search"
                            >
                                <i className="fa-solid fa-circle-xmark"></i>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsGuideOpen(!isGuideOpen)}
                            className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-indigo-400 transition-colors ${isGuideOpen ? 'text-indigo-400' : ''}`}
                        >
                            <i className="fa-solid fa-circle-info"></i>
                        </button>
                    </form>

                    <SearchGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
                </div>
            </div>

            <div className="bg-gray-800/20 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                                <th className="px-6 py-4">Hostname</th>
                                <th className="px-6 py-4">OS Version</th>
                                <th className="px-6 py-4">Last Reboot</th>
                                <th className="px-6 py-4">Last Patched</th>
                                <th className="px-6 py-4">Patching Schedule</th>
                                <th className="px-6 py-4">Environment</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {/* INITIAL LOAD: Only show skeleton if we have NO servers and are loading.
                                Otherwise, always show the servers we have.
                            */}
                            {servers.length === 0 && isLoading ? (
                                <TableSkeleton />
                            ) : (
                                <>
                                    {servers.map((server, index) => {
                                        const isLastElement = servers.length === index + 1;
                                        return (
                                            <ServerRow
                                                key={server.id}
                                                server={server}
                                                query={activeQuery}
                                                innerRef={isLastElement ? lastElementRef : null}
                                            />
                                        );
                                    })}

                                    {/* LOAD MORE INDICATOR: Show a subtle loading row at the bottom 
                                        when fetching the next page so the list doesn't just "jump."
                                    */}
                                    {isLoading && servers.length > 0 && (
                                        <tr>
                                            <td colSpan="6" className="py-4 text-center">
                                                <div className="flex items-center justify-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                                                    <i className="fa-solid fa-circle-notch animate-spin"></i>
                                                    Loading More Nodes...
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )}

                            {!isLoading && servers.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="py-20 text-center">
                                        <i className="fa-solid fa-box-open text-4xl text-gray-700 mb-4 block"></i>
                                        <p className="text-gray-500">No servers match your search criteria.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <button
                onClick={scrollToTop}
                className={`fixed bottom-8 right-8 p-4 rounded-xl bg-indigo-500 text-white shadow-2xl shadow-indigo-500/20 z-50 transition-all duration-300 transform hover:bg-indigo-400 hover:-translate-y-1 active:scale-95 ${showScrollTop
                        ? 'opacity-100 translate-y-0 visible'
                        : 'opacity-0 translate-y-10 invisible'
                    }`}
                aria-label="Scroll to top"
            >
                <i className="fa-solid fa-arrow-up text-lg"></i>
            </button>
        </div>
    );
};

export default Servers;