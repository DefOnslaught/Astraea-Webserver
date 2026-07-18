import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";

const HistorySearchGuide = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const filters = [
        { label: "Date & Time", desc: "Filter by age (d, w, m, y)", ex: ">10d" },
        { label: "Status", desc: "Filter by outcome", ex: "success" },
        { label: "Errors", desc: "Search specific messages", ex: "Mismatched update" },
    ];

    return (
        <div className="absolute top-full mt-2 w-80 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-5 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Search Guide</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="space-y-4">
                {filters.map((f) => (
                    <div key={f.label} className="group">
                        {/* Title and Description */}
                        <div className="flex items-baseline gap-2 mb-1.5">
                            <span className="text-gray-200 text-xs font-medium">
                                {f.label}
                            </span>
                            <span className="text-[11px] text-gray-500">
                                {f.desc}
                            </span>
                        </div>

                        {/* Actionable Example */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-gray-600 uppercase tracking-wider font-semibold">
                                Try:
                            </span>
                            <code className="text-indigo-400 font-mono text-xs bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded cursor-text select-all">
                                {f.ex}
                            </code>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HistorySearchGuide;