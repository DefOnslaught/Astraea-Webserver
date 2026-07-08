import { useEffect, useRef } from 'react';
import SectionLoader from '../../../components/SectionLoader';
import { AlertTriangle, Loader2, ArrowDownCircle, Timer, RotateCcw, Clock } from 'lucide-react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleExclamation, faCircleInfo } from "@fortawesome/free-solid-svg-icons";

const HistoryTable = ({ history, onSelectSession, error, loading, loadingMore, hasMore, isInfinite, loadMore, searchQuery, onHandleShowingErrorLog }) => {
    const observerTarget = useRef(null);

    useEffect(() => {
        if (loading || loadingMore || !hasMore || !isInfinite) return;

        const currentTarget = observerTarget.current;
        if (!currentTarget) return;

        const observer = new IntersectionObserver(
            entries => {
                const target = entries[0];
                if (target.isIntersecting && !loadingMore) {
                    loadMore(false);
                }
            },
            {
                root: null,
                rootMargin: '100px',
                threshold: 0.01
            }
        );

        observer.observe(currentTarget);

        return () => {
            if (currentTarget) {
                observer.unobserve(currentTarget);
            }
        };
    }, [loading, loadingMore, hasMore, isInfinite, loadMore]);

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <SectionLoader label='Loading Patch History...' />
            </div>
        );
    }

    if (error && history.length === 0) {
        return <div className="p-10 text-red-500 flex items-center gap-2"><AlertTriangle />{error}</div>;
    }

    if (history.length === 0) {
        return (
            <div className="p-6 text-slate-500 italic text-center">
                {searchQuery
                    ? `No records found matching "${searchQuery}".`
                    : "No records have been found for this endpoint."}
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="text-slate-500 text-sm uppercase">
                    <tr>
                        <th className="pb-4">Timestamp</th>
                        <th className="pb-4">Duration</th>
                        <th className="pb-4">Status</th>
                        <th className="pb-4">Updated</th>
                        <th className="pb-4">Rebooted</th>
                        <th className="pb-4">Uptime At Run</th>
                        <th className="pb-4">Logs / Errors</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {history.map(session => (
                        <tr key={session.id} className="hover:bg-slate-800/30 transition-colors group">
                            <td className="py-4 font-mono text-sm">
                                <button
                                    onClick={() => onSelectSession(session)}
                                    className="group flex w-full text-left items-center gap-2 text-slate-200 hover:text-slate-50 transition-colors"
                                >
                                    <span className="group-hover:underline underline-offset-4">
                                        {new Date(session.timestamp).toLocaleString('en-GB', {
                                            dateStyle: 'medium',
                                            timeStyle: 'short'
                                        })}
                                    </span>
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                                        <FontAwesomeIcon icon={faCircleInfo} className="w-3.5 h-3.5" />
                                    </span>
                                </button>
                            </td>
                            <td className="py-4 font-mono text-sm text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <Timer className="w-3.5 h-3.5 text-slate-500" />
                                    <span>{session.duration}</span>
                                </div>
                            </td>
                            <td className="py-4">
                                {(() => {
                                    const status = (session.status || 'unknown').toLowerCase();

                                    // Comprehensive Style Map
                                    const styleMap = {
                                        success: {
                                            dot: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]",
                                            text: "text-emerald-400",
                                            bg: "bg-emerald-500/5 border-emerald-500/10"
                                        },
                                        failed: {
                                            dot: "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)] animate-pulse",
                                            text: "text-red-400",
                                            bg: "bg-red-500/5 border-red-500/10"
                                        },
                                        partial: {
                                            dot: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]",
                                            text: "text-amber-400",
                                            bg: "bg-amber-500/5 border-amber-500/10"
                                        },
                                        unknown: {
                                            dot: "bg-gray-500",
                                            text: "text-gray-500",
                                            bg: "bg-gray-500/5 border-gray-500/10"
                                        }
                                    };

                                    const theme = styleMap[status] || styleMap.unknown;

                                    return (
                                        <div className="flex items-center">
                                            {/* Inline Badge Container */}
                                            <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border ${theme.bg} transition-all duration-300`}>
                                                {/* Status Dot */}
                                                <div className={`h-1.5 w-1.5 rounded-full ${theme.dot}`}> </div>

                                                {/* Status Label */}
                                                <span className={`text-[11px] font-bold uppercase tracking-wider ${theme.text}`}>
                                                    {status}
                                                </span>

                                                {/* Conditional "Action Required" icon for Failed/Partial */}
                                                {(status === 'failed' || status === 'partial') && (
                                                    <FontAwesomeIcon icon={faCircleExclamation} className={`text-[10px] ${theme.text} ml-1`} />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </td>
                            <td className="py-4 text-slate-300">
                                <span className="font-bold text-indigo-400">{session.total}</span> pkgs
                            </td>
                            <td className="py-4">
                                {session.was_rebooted ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <RotateCcw className="w-3 h-3" />
                                        Rebooted
                                    </span>
                                ) : (
                                    <span className="text-slate-600 text-xs italic">No</span>
                                )}
                            </td>
                            <td className="py-4">
                                {session.uptime ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        {session.uptime}
                                    </span>
                                ) : (
                                    <span className="text-slate-600 text-xs italic">Unknown</span>
                                )}
                            </td>
                            <td className="py-4">
                                {session.error_log ? (
                                    <button
                                        onClick={() => onHandleShowingErrorLog(session.error_log, session.timestamp)}
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
                </tbody>
            </table>

            {(hasMore || isInfinite) && (
                <div className="w-full flex flex-col items-center justify-center mt-6 pt-4 border-t border-slate-800/60">
                    {!isInfinite && hasMore && (
                        <button
                            type="button"
                            onClick={() => loadMore(true)}
                            disabled={loadingMore}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 disabled:text-slate-600 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700/60 transition-all active:scale-[0.98]"
                        >
                            {loadingMore ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                    Indexing Records...
                                </>
                            ) : (
                                <>
                                    <ArrowDownCircle className="w-3.5 h-3.5 text-indigo-400" />
                                    Load More History
                                </>
                            )}
                        </button>
                    )}

                    {isInfinite && (
                        <div ref={observerTarget} className="h-14 w-full flex items-center justify-center text-slate-400 text-xs font-medium">
                            {loadingMore ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                    Fetching older historical entries...
                                </div>
                            ) : !hasMore ? (
                                <span className="text-slate-600 italic">All historical updates loaded.</span>
                            ) : null}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default HistoryTable;