import { useState } from "react";
import { useNavigate } from "react-router-dom";

const PackageRow = ({ pkg, innerRef }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const navigate = useNavigate();

    return (
        <>
            <tr
                ref={innerRef}
                className={`group hover:bg-white/3 transition-all cursor-pointer border-b border-white/5 ${isExpanded ? 'bg-indigo-500/5' : ''}`}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <td className="px-6 py-4 text-center w-10">
                    <i className={`fa-solid fa-chevron-right transition-transform duration-300 text-gray-600 ${isExpanded ? 'rotate-90 text-indigo-400' : ''}`}></i>
                </td>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 text-indigo-400'} border border-indigo-500/20`}>
                            <i className="fa-solid fa-cube text-sm"></i>
                        </div>
                        <span className="text-white font-semibold tracking-tight">{pkg.name}</span>
                    </div>
                </td>
                <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400 bg-gray-800 px-2 py-0.5 rounded border border-white/5">
                            {pkg.versions.length} {pkg.versions.length > 1 ? 'Versions' : 'Version'}
                        </span>
                    </div>
                </td>
                <td className="px-6 py-4 text-right">
                    <div className="inline-flex flex-col items-end">
                        <span className="text-indigo-400 text-sm font-bold">
                            {pkg.versions.reduce((a, b) => a + (b.count || 0), 0)}
                        </span>
                        <span className="text-[10px] text-gray-500 uppercase tracking-tighter">Total Installs</span>
                    </div>
                </td>
            </tr>

            {isExpanded && (
                <tr className="bg-black/20">
                    <td colSpan="4" className="px-12 py-4">
                        <div className="flex flex-wrap gap-3">
                            {pkg.versions.map(v => (
                                <button
                                    key={v.version}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/packages/${pkg.name}/instances?v=${v.version}`);
                                    }}
                                    className="flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-800/50 border border-white/5 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all text-sm"
                                >
                                    <i className="fa-solid fa-folder text-indigo-400"></i>
                                    <span className="text-gray-300 font-mono">v{v.version}</span>
                                    <span className="text-[10px] text-gray-500">({v.count} Servers)</span>
                                </button>
                            ))}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
};

export default PackageRow;