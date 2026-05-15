import SectionLoader from '../../../components/SectionLoader';
import { AlertTriangle } from 'lucide-react';

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

export default HistoryTable;