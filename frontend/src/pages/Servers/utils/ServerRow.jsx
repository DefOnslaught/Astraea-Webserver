import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import HighlightText from "../../../utils/HighlightText";
import getDaysAgo from "../../../utils/getDaysAgo";
import truncateString from "../../../utils/truncateString";
import { PATCH_THRESHOLD_DAYS } from "../../../utils/constants";
import ConfigureServerModal from "./ConfigureServerModal";
import ActionDropdown from "./ActionDropdown";

const ServerRow = ({ server, query, innerRef, onRefresh, onSuccess }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const menuRef = useRef(null);
    const actionButtonRef = useRef(null);
    const navigate = useNavigate();

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

    const handleSuccess = () => {
        onRefresh();
        onSuccess(`Updated ${server.hostname} successfully!`);
    }

    return (
        <tr ref={innerRef} className="group hover:bg-white/[0.02] transition-colors">

            {/* HOSTNAME */}
            <td className="px-6 py-4">
                <button
                    onClick={() => navigate(`/inspect/${server.server_id}/`)}
                    className="flex items-center gap-3 group/host text-left outline-none"
                >
                    <div className="p-3 rounded-xl bg-white/5 group-hover/host:bg-indigo-500/10 group-hover/host:scale-110 transition-all duration-300">
                        <i className="fa-solid fa-server text-gray-500 group-hover/host:text-indigo-400 transition-colors"></i>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-gray-400 group-hover/host:text-white transition-colors">
                            <HighlightText text={server.hostname} query={query} field="host" />
                        </span>
                        {/* Optional: Add a subtle 'Click to inspect' hint that appears on hover */}
                        <span className="text-[10px] text-indigo-500/0 group-hover/host:text-indigo-500/70 transition-all uppercase tracking-tighter font-bold">
                            View Details
                        </span>
                    </div>
                </button>
            </td>

            {/* OS VERSION */}
            <td className="px-6 py-4">
                <span className="text-sm text-gray-400">
                    <HighlightText text={server.os_version} query={query} field="os" />
                </span>
            </td>

            {/* LAST REBOOT */}
            <td className="px-6 py-4">
                {(() => {
                    const patchDaysInMs = PATCH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
                    const lastRebootDate = server.last_reboot ? new Date(server.last_reboot) : null;
                    const isStale = lastRebootDate && (new Date() - lastRebootDate > patchDaysInMs);
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
                                    Last known uptime {server.uptime || "0 days"}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </td>
            <td className="px-6 py-4 text-sm text-gray-400 font-mono">
                {(() => {
                    const patchDaysInMs = PATCH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
                    const lastPatchDate = server.last_patch ? new Date(server.last_patch) : null;
                    const isStale = lastPatchDate && (new Date() - lastPatchDate > patchDaysInMs);
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
                            field="schedule"
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
                            <HighlightText text={envValue} query={query} field="env" />
                        </div>
                    );
                })()}
            </td>

            {/* ACTIONS TD */}
            <td className="px-6 py-4 text-right relative">
                <div ref={actionButtonRef} className="inline-block text-left">
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
                    <ActionDropdown
                        isOpen={isMenuOpen}
                        onClose={() => setIsMenuOpen(false)}
                        anchorRef={actionButtonRef}
                    >
                        <button
                            onClick={() => { 
                                setIsMenuOpen(false); 
                                navigate(`/inspect/${server.server_id}/`);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-indigo-400 transition-colors"
                        >
                            <i className="fa-solid fa-eye text-xs"></i>
                            Inspect
                        </button>
                        <div className="h-px bg-white/5"></div>
                        <button
                            onClick={() => {
                                setIsConfigOpen(true);
                                setIsMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-indigo-400 transition-colors"
                        >
                            <i className="fa-solid fa-sliders text-xs"></i>
                            Configure
                        </button>
                    </ActionDropdown>
                </div>

                {/* RENDER MODAL */}
                {isConfigOpen && (
                    <ConfigureServerModal
                        server_id={server.server_id}
                        onClose={() => setIsConfigOpen(false)}
                        onUpdateSuccess={handleSuccess}
                    />
                )}
            </td>
        </tr>
    );
};

export default ServerRow;