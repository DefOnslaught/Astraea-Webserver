import { useState, useEffect } from 'react';
import api from '../../../../utils/api';
import { API_ENDPOINTS } from "../../../../utils/constants";
import {
    X, Loader2, ChevronLeft, Clock, AlertTriangle
} from 'lucide-react';

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

    // Lock background scrolling
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

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
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 overflow-x-hidden overflow-y-hidden">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* Modal Header */}
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Clock className="w-5 h-5 text-indigo-400" />
                            Session Details
                        </h2>
                        <p className="text-sm text-slate-500 font-mono mt-1">
                            {new Date(session.timestamp).toLocaleString()} - Duration {session.duration}
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
                                    Modified Packages ({details.total_updated})
                                </h3>
                                <div className="grid gap-2">
                                    {details.updates.map((upd, i) => {
                                        const status = getVersionStatus(upd.old_version, upd.new_version);
                                        return (
                                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-slate-800/40 border border-slate-700/50 rounded-lg group hover:border-slate-600 transition-colors gap-3">

                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-slate-200 font-medium break-all sm:truncate">
                                                        {upd.name}
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2 font-mono text-xs bg-slate-950/50 sm:bg-transparent p-2 sm:p-0 rounded-md">
                                                    <span className="text-slate-500 line-through decoration-slate-700 truncate max-w-30 sm:max-w-none">
                                                        {upd.old_version || '0.0.0'}
                                                    </span>

                                                    <ChevronLeft className="w-3 h-3 text-slate-600 rotate-180 shrink-0" />

                                                    <span className={`${status.color} font-bold bg-slate-950 px-2 py-1 rounded border border-slate-800 break-all text-center`}>
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

export default SessionDetailsModal;