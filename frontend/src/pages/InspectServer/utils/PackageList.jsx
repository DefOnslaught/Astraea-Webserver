import { useState, useEffect, useMemo } from 'react';
import { API_ENDPOINTS } from '../../../utils/constants';
import SectionLoader from '../../../components/SectionLoader';
import {
    X, Loader2, Package, AlertTriangle, Search
} from 'lucide-react';

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

export default PackageList;