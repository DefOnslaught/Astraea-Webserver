import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faServer,
    faClockRotateLeft,
    faCircleExclamation,
    faCalendarCheck,
    faLayerGroup,
    faShieldHeart,
    faFlaskVial,
    faCodeBranch,
    faEllipsisVertical,
    faEye,
    faSliders
} from "@fortawesome/free-solid-svg-icons";

import HighlightText from "../../../utils/HighlightText";
import getDaysAgo from "../../../utils/getDaysAgo";
import truncateString from "../../../utils/truncateString";
import { PATCH_THRESHOLD_DAYS } from "../../../utils/constants";
import ConfigureServerModal from "./ConfigureServerModal";
import ActionDropdown from "./ActionDropdown";
import getRelativeTime from "../../../utils/getRelativeTime";

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
    };

    return (
        <tr ref={innerRef} className="group hover:bg-white/2 transition-colors">

            {/* HOSTNAME */}
            <td className="px-6 py-4">
                <button
                    onClick={() => navigate(`/inspect/${server.server_id}/`)}
                    className="flex items-center gap-3 group/host text-left outline-none"
                >
                    <div className="p-3 rounded-xl bg-white/5 group-hover/host:bg-indigo-500/10 group-hover/host:scale-110 transition-all duration-300">
                        <FontAwesomeIcon icon={faServer} className="text-gray-500 group-hover/host:text-indigo-400 transition-colors" />
                    </div>
                    <div className="flex flex-col relative justify-center">
                        <span className="font-semibold text-gray-400 group-hover/host:text-white transition-colors leading-tight">
                            <HighlightText text={server.hostname} query={query} field="host" />
                        </span>

                        <span className="absolute top-full left-0 text-[10px] text-indigo-500 opacity-0 group-hover/host:opacity-70 transition-all uppercase tracking-tighter font-bold whitespace-nowrap">
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
                                <FontAwesomeIcon icon={faClockRotateLeft} className="text-[9px] text-gray-600" />
                                <span className="text-[10px] text-gray-500 font-mono">
                                    Last known uptime {server.uptime || "0 days"}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </td>

            {/* LAST PATCHED */}
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
                            <div className="flex items-center gap-2 pl-4">
                                <FontAwesomeIcon icon={faClockRotateLeft} className="text-[9px] text-gray-600" />
                                <span className="text-[10px] text-gray-500 font-mono">
                                    {getRelativeTime(server.last_patch)}
                                </span>
                            </div>
                        </div>
                    );
                })()}
            </td>

            {/* LAST STATUS */}
            <td className="px-6 py-4">
                {(() => {
                    const status = (server.last_patch_status || 'unknown').toLowerCase();

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
                                <div className={`h-1.5 w-1.5 rounded-full ${theme.dot}`}></div>

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

            {/* PATCHING SCHEDULE */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-2 group/schedule">
                    <FontAwesomeIcon
                        icon={faCalendarCheck}
                        className="text-[10px] text-indigo-500/50 group-hover/schedule:text-indigo-400 transition-colors"
                    />
                    <span
                        className="text-xs text-gray-400 italic cursor-help"
                        title={server.patch_schedule}
                    >
                        <HighlightText
                            text={truncateString(server.patch_schedule || "Not Set", 30)}
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

                    // Define style values
                    let badgeStyle = "bg-gray-500/10 text-gray-400 border-gray-500/20";
                    let selectedIcon = faLayerGroup; // Default imported module reference instead of a string

                    if (isProd) {
                        badgeStyle = "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]";
                        selectedIcon = faShieldHeart;
                    } else if (isPreProd) {
                        badgeStyle = "bg-purple-500/10 text-purple-400 border-purple-500/20";
                        selectedIcon = faFlaskVial;
                    } else if (isDev) {
                        badgeStyle = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                        selectedIcon = faCodeBranch;
                    }

                    return (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${badgeStyle} transition-all duration-300 group-hover:scale-105`}>
                            <FontAwesomeIcon icon={selectedIcon} className="text-[9px]" />
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
                        <FontAwesomeIcon icon={faEllipsisVertical} />
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
                            <FontAwesomeIcon icon={faEye} className="text-xs" />
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
                            <FontAwesomeIcon icon={faSliders} className="text-xs" />
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