import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faXmark } from "@fortawesome/free-solid-svg-icons";

const HistorySearchGuide = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const filters = [
        { key: "Timestamp", desc: "Filter by date length (d, w, m, y)", ex: ">10d" },
        { key: "Status", desc: "Filter by status", ex: "successful" },
        { key: "Error", desc: "Filter by any errors", ex: "Mismatched update" },
    ];

    return (
        <div className="absolute top-full mt-2 w-80 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-5 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Search Syntax</h3>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
            <div className="space-y-3">
                {filters.map((f) => (
                    <div key={f.key} className="group">
                        <div className="flex items-center gap-2">
                            <span
                                className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded cursor-default"
                            >
                                {f.key}
                            </span>
                            <span className="text-[11px] text-gray-400">{f.desc}</span>
                        </div>
                        <p className="text-[10px] text-gray-600 mt-1 italic group-hover:text-gray-500 transition-colors">
                            Example: {f.ex}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HistorySearchGuide;