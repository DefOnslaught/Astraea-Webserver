import { useState, useRef} from "react";
import { useNavigate } from "react-router-dom";
import {
    User, MoreVertical, Eye, Key, ShieldAlert,
    Clock
} from "lucide-react";
import ActionDropdown from "../../Servers/utils/ActionDropdown";
import formatLastLogin from "./formatLastLogin";

const UserRow = ({ user, onRefresh }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const actionButtonRef = useRef(null);
    const navigate = useNavigate();

    const isOnline = user.last_login &&
        (new Date() - new Date(user.last_login)) < (15 * 60 * 1000);

    return (
        <tr className="group hover:bg-white/2 transition-colors">
            {/* USER IDENTITY - CLICKABLE */}
            <td className="px-6 py-4">
                <button
                    onClick={() => navigate(`/administration/users/inspect/${user.username}/`)}
                    className="flex items-center gap-3 group/host text-left outline-none"
                >
                    <div className="p-3 rounded-xl bg-white/5 group-hover/host:bg-indigo-500/10 group-hover/host:scale-110 transition-all duration-300">
                        <User className="w-5 h-5 text-gray-500 group-hover/host:text-indigo-400 transition-colors" />
                    </div>
                    <div className="flex flex-col relative justify-center">
                        <span className="font-semibold text-gray-400 group-hover/host:text-white transition-colors leading-tight">
                            {user.username}
                        </span>
                        <span className="text-xs text-gray-500">{user.email}</span>
                        <span className="absolute top-[110%] left-0 text-[10px] text-indigo-500 opacity-0 group-hover/host:opacity-100 transition-all uppercase tracking-tighter font-bold whitespace-nowrap">
                            Inspect User
                        </span>
                    </div>
                </button>
            </td>

            {/* IS ACTIVE */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    <div className={`h-1.5 w-1.5 rounded-full ${user.is_active ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-gray-600'}`}></div>
                    <span className={`text-xs font-medium ${user.is_active ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {user.is_active ? "Active" : "Disabled"}
                    </span>
                </div>
            </td>

            {/* PERMISSIONS */}
            <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                    {user.is_superuser ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-red-500/20 bg-red-500/5 text-red-400 text-[10px] font-bold uppercase tracking-widest">
                            <ShieldAlert className="w-3 h-3" /> Root
                        </div>
                    ) : user.is_staff ? (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-[10px] font-bold uppercase tracking-widest">
                            <Clock className="w-3 h-3" /> Staff
                        </div>
                    ) : (
                        <span className="text-gray-600 text-[11px] px-2 italic">Standard</span>
                    )}
                </div>
            </td>

            {/* LAST LOGIN */}
            <td className="px-6 py-4">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-xs">
                        <Clock className={`w-3 h-3 ${isOnline ? 'text-emerald-400' : 'text-gray-600'}`} />
                        <span className={isOnline ? 'text-emerald-400 font-medium' : 'text-gray-400'}>
                            {user.last_login ? formatLastLogin(user.last_login) : "Never"}
                        </span>
                    </div>
                    {!isOnline && user.last_login && (
                        <span className="text-[10px] text-gray-600 ml-5">
                            {new Date(user.last_login).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </td>

            {/* ACTIONS */}
            <td className="px-6 py-4 text-right">
                <div ref={actionButtonRef} className="inline-block">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`p-2 rounded-lg transition-all ${isMenuOpen ? 'bg-indigo-500 text-white' : 'text-gray-500 hover:bg-white/10 hover:text-white'}`}
                    >
                        <MoreVertical className="w-4 h-4" />
                    </button>

                    <ActionDropdown
                        isOpen={isMenuOpen}
                        onClose={() => setIsMenuOpen(false)}
                        anchorRef={actionButtonRef}
                    >
                        <button
                            onClick={() => { navigate(`/administration/users/inspect/${user.username}/`); setIsMenuOpen(false); }}
                            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-indigo-400 transition-colors"
                        >
                            <Eye className="w-4 h-4" /> Inspect
                        </button>
                    </ActionDropdown>
                </div>
            </td>
        </tr>
    );
};

export default UserRow;