import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { API_ENDPOINTS } from "../../utils/constants";
import api from "../../utils/api";
import useDocumentTitle from "../../utils/useDocumentTitle";
import getDaysAgo from "../../utils/getDaysAgo";
import truncateString from "../../utils/truncateString";

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


const HighlightText = ({ text, query }) => {
    // Return early if there's nothing to highlight or text is empty
    if (!query || !query.trim() || !text) return <span>{text}</span>;

    const uniqueTerms = useMemo(() => {
        // Regex for: (key):"quoted value" OR (key):unquotedValue OR generalTerm
        const tokenRegex = /(?:(\w+):)?(?:"([^"]+)"|([^\s]+))/g;
        const terms = new Set();
        let match;

        // Reset the regex state just in case it's defined outside or reused
        tokenRegex.lastIndex = 0;

        while ((match = tokenRegex.exec(query.toLowerCase())) !== null) {
            // match[2] is a quoted value, match[3] is an unquoted value/general term
            const value = match[2] || match[3];

            // FIX: Removed the "length > 1" check to allow single characters
            if (value) {
                // Escape special characters to prevent regex injection (e.g., searching for ".")
                const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                terms.add(escaped);
            }
        }

        // Sort by length descending: ensures "web-01" is matched before "web"
        return Array.from(terms).sort((a, b) => b.length - a.length);
    }, [query]);

    const highlightRegex = useMemo(() => {
        if (uniqueTerms.length === 0) return null;
        // The 'gi' flags ensure global matching and case-insensitivity
        return new RegExp(`(${uniqueTerms.join('|')})`, 'gi');
    }, [uniqueTerms]);

    // If no valid regex could be built, return original text
    if (!highlightRegex) return <span>{text}</span>;

    // Split the text into parts using the capturing group in the regex
    // This keeps the delimiters (the matches) in the resulting array
    const parts = text.split(highlightRegex);

    return (
        <span className="break-all">
            {parts.map((part, i) => {
                // Test if this specific part is one of the search terms
                // We use a clean match test here
                const isMatch = highlightRegex.test(part);

                // Since test() advances the lastIndex on global regexes, 
                // and we're in a loop, we reset it or rely on the fact 
                // that each part is checked individually.
                highlightRegex.lastIndex = 0;

                return isMatch ? (
                    <mark
                        key={i}
                        className="bg-indigo-500/30 text-indigo-200 rounded-sm px-0.5 border-b border-indigo-500/50 transition-colors"
                    >
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                );
            })}
        </span>
    );
};


const ServerRow = ({ server, query, innerRef }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);

    // Close the menu if the user clicks anywhere else on the page
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isMenuOpen]);

    return (
        <tr ref={innerRef} className="group hover:bg-white/[0.02] transition-colors">
     
            {/* HOSTNAME */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-white/5 group-hover:scale-110 transition-transform duration-300">
                        <i className={`fa-solid fa-server text-gray-500 group-hover:text-indigo-400 transition-colors`}></i>
                    </div>
                    <span className="font-semibold text-gray-400 group-hover:text-indigo-400 transition-colors">
                        <HighlightText text={server.hostname} query={query} />
                    </span>
                </div>
            </td>

            {/* OS VERSION */}
            <td className="px-6 py-4">
                <span className="text-sm text-gray-400">
                    <HighlightText text={server.os_version} query={query} />
                </span>
            </td>

            {/* LAST REBOOT */}
            <td className="px-6 py-4">
                {(() => {
                    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
                    const lastRebootDate = server.last_reboot ? new Date(server.last_reboot) : null;
                    const isStale = lastRebootDate && (new Date() - lastRebootDate > thirtyDaysInMs);
                    const isUnknown = !server.last_reboot;

                    // Determine color and effect
                    let statusColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
                    let statusEffect = "";

                    if (isUnknown) {
                        statusColor = "bg-gray-600";
                        statusEffect = "animate-pulse";
                    } else if (isStale) {
                        statusColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]";
                        statusEffect = "animate-pulse";
                    }

                    return (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                {/* Status indicator: Emerald (Healthy), Amber (Stale), Gray (Unknown) */}
                                <div className={`h-2 w-2 rounded-full ${statusColor} ${statusEffect}`}></div>
                                <span className={`text-xs font-medium ${isStale ? 'text-amber-400' : 'text-gray-400'}`}>
                                    {isUnknown ? "Needs Audit" : getDaysAgo(server.last_reboot)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 pl-4">
                                <i className="fa-solid fa-clock-rotate-left text-[9px] text-gray-600"></i>
                                <span className="text-[10px] text-gray-500 font-mono">
                                    Uptime at reboot {server.uptime || "0 days"}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </td>
            <td className="px-6 py-4 text-sm text-gray-400 font-mono">
                {(() => {
                    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
                    const lastPatchDate = server.last_patch ? new Date(server.last_patch) : null;
                    const isStale = lastPatchDate && (new Date() - lastPatchDate > thirtyDaysInMs);
                    const isUnknown = !server.last_patch;

                    // Determine color and effect
                    let statusColor = "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]";
                    let statusEffect = "";

                    if (isUnknown) {
                        statusColor = "bg-gray-600";
                        statusEffect = "animate-pulse";
                    } else if (isStale) {
                        statusColor = "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]";
                        statusEffect = "animate-pulse";
                    }

                    return (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                {/* Status indicator: Emerald (Healthy), Amber (Stale), Gray (Unknown) */}
                                <div className={`h-2 w-2 rounded-full ${statusColor} ${statusEffect}`}></div>
                                <span className={`text-xs font-medium ${isStale ? 'text-amber-400' : 'text-gray-400'}`}>
                                    {isUnknown ? "Never" : getDaysAgo(server.last_patch)}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </td>
            
            {/* PATCHING SCHEDULE */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-2 group/schedule">
                    <i className="fa-solid fa-calendar-check text-[10px] text-indigo-500/50 group-hover/schedule:text-indigo-400 transition-colors"></i>
                    <span
                        className="text-xs text-gray-400 italic cursor-help"
                        title={server.patch_schedule}
                    >
                        <HighlightText
                            text={truncateString(server.patch_schedule, 30)}
                            query={query}
                        />
                    </span>
                </div>
            </td>

            {/* ENVIRONMENT */}
            <td className="px-6 py-4">
                {(() => {
                    const envValue = server.env || 'Unknown';
                    const isProd = envValue.toLowerCase().includes('prod') && !envValue.toLowerCase().includes('pre');
                    const isPreProd = envValue.toLowerCase().includes('pre');
                    const isDev = envValue.toLowerCase().includes('dev');

                    // Define a dynamic style based on the environment type
                    let badgeStyle = "bg-gray-500/10 text-gray-400 border-gray-500/20"; // Default
                    let icon = "fa-layer-group";

                    if (isProd) {
                        badgeStyle = "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]";
                        icon = "fa-shield-heart";
                    } else if (isPreProd) {
                        badgeStyle = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                        icon = "fa-flask-vial";
                    } else if (isDev) {
                        badgeStyle = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        icon = "fa-code-branch";
                    }

                    return (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badgeStyle} transition-all duration-300 group-hover:scale-105`}>
                            <i className={`fa-solid ${icon} text-[9px]`}></i>
                            <HighlightText text={envValue} query={query} />
                        </div>
                    );
                })()}
            </td>

            {/* ACTIONS TD */}
            <td className="px-6 py-4 text-right relative">
                <div ref={menuRef} className="inline-block text-left">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`p-2 rounded-lg transition-all duration-200 ${isMenuOpen
                                ? 'bg-indigo-500 text-white'
                                : 'text-gray-500 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>

                    {/* ACTIONS DROPDOWN */}
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-40 bg-gray-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1">
                            <button
                                onClick={() => { console.log("Inspect", server.id); setIsMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-indigo-400 transition-colors"
                            >
                                <i className="fa-solid fa-eye text-xs"></i>
                                Inspect
                            </button>
                            <div className="h-px bg-white/5"></div>
                            <button
                                onClick={() => { console.log("Configure", server.id); setIsMenuOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-indigo-400 transition-colors"
                            >
                                <i className="fa-solid fa-sliders text-xs"></i>
                                Configure
                            </button>
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
};

const TableSkeleton = () => (
    <>
        {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="animate-pulse">
                <td colSpan="7" className="px-6 py-4">
                    <div className="h-12 bg-white/5 rounded-xl w-full"></div>
                </td>
            </tr>
        ))}
    </>
);

const SearchGuide = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const filters = [
        { key: "host:", desc: "Filter by hostname", ex: "host:web-01" },
        { key: "os:", desc: "Filter by OS version", ex: "os:ubuntu" },
        { key: "ip:", desc: "Filter by IP address", ex: "ip:192.168" },
        { key: "mac:", desc: "Filter by MAC address", ex: "mac:52:54" },
        { key: "env:", desc: "Filter by Environment", ex: "env:Prod or env:none" },
        { key: "reboot:", desc: "Filter by date length (d, w, m, y)", ex: "reboot:>14d" },
        { key: "patched:", desc: "Filter by date length (d, w, m, y)", ex: "patched:>3d" },
        { key: "schedule:", desc: "Filter by Patching Schedule", ex: "schedule:10am wednesday" },
    ];

    return (
        <div className="absolute top-16 right-0 w-80 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-5 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Search Syntax</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div className="space-y-3">
                {filters.map((f) => (
                    <div key={f.key} className="group">
                        <div className="flex items-center gap-2">
                            <code className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded">{f.key}</code>
                            <span className="text-[11px] text-gray-400">{f.desc}</span>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1 italic group-hover:text-gray-500 transition-colors">
                            Example: {f.ex}
                        </p>
                    </div>
                ))}
                <div className="pt-3 border-t border-white/5">
                    <p className="text-[10px] text-gray-500 leading-relaxed">
                        Combine multiple filters to narrow results. Plain text searches all fields.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Servers;