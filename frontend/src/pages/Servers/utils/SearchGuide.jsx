import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck, faXmark } from "@fortawesome/free-solid-svg-icons";

const SearchGuide = ({ isOpen, onClose, onSelectKey }) => {
    if (!isOpen) return null;

    const filters = [
        { key: "host:", desc: "Filter by hostname", ex: "host:web-01" },
        { key: "id:", desc: "Filter by Server UUID", ex: "id:d367fda3" },
        { key: "os:", desc: "Filter by OS version", ex: "os:ubuntu" },
        { key: "ip:", desc: "Filter by IP address", ex: "ip:192.168" },
        { key: "mac:", desc: "Filter by MAC address", ex: "mac:52:54" },
        { key: "env:", desc: "Filter by Environment", ex: "env:Prod or env:none" },
        { key: "reboot:", desc: "Filter by date length (d, w, m, y)", ex: "reboot:>14d" },
        { key: "patched:", desc: "Filter by date length (d, w, m, y)", ex: "patched:>3d" },
        { key: "status:", desc: "Filter by Last Status", ex: "status:success" },
        { key: "enabled:", desc: "Filter by Patching enabled", ex: "enabled:false" },
        { key: "schedule:", desc: "Filter by Patching Schedule", ex: "schedule:10am wednesday" },
    ];

    return (
        <div className="absolute top-16 right-0 w-80 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 p-5 animate-in fade-in slide-in-from-top-2">
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
                            <button
                                type="button"
                                onClick={() => onSelectKey(f.key)}
                                className="text-indigo-400 font-mono text-xs bg-indigo-500/10 px-1.5 py-0.5 rounded hover:bg-indigo-500/20 hover:text-indigo-300 transition-all active:scale-95"
                                title={`Insert ${f.key}`}
                            >
                                {f.key}
                            </button>
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

export default SearchGuide;