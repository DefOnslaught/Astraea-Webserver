import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faAlignLeft,
    faBars,
    faUser,
    faChevronDown,
    faRightFromBracket,
    faHouse,
    faServer,
    faCubes,
    faGears,
    faUsersGear,
    faFileLines
} from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "../utils/AuthContext";
import { usePathCheck } from "../hooks/usePathCheck";
import LogoutModal from "./LogoutModal";
import { VERSION } from "../utils/constants";
 
function Layout({ children }) {
    const { user, isAuthorized, loading } = useAuth();
    const { isAuthPage, pathname } = usePathCheck();
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        return localStorage.getItem("sidebarOpen") !== "false";
    });
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    const navigate = useNavigate();
    
    const username = user?.username || "User";
    const hasAdminAccess = user?.is_staff || user?.is_superuser;

    if (loading && !isAuthorized) {
        return <div className="min-h-screen bg-gray-900" />;
    }
    
    if (isAuthPage || !isAuthorized) {
        return <div className="min-h-screen bg-gray-900">{children}</div>;
    }


    const handleLogoutClick = () => {
        setIsLogoutModalOpen(true);
        setIsUserMenuOpen(false);
    }

    const toggleSidebar = () => {
        setIsSidebarOpen((prev) => {
            const newState = !prev;
            localStorage.setItem("sidebarOpen", newState); // Save as string "true" or "false"
            return newState;
        });
    };

    return (
        <div className="min-h-screen bg-gray-900">
            <LogoutModal
                isOpen={isLogoutModalOpen}
                onCancel={() => setIsLogoutModalOpen(false)}
                onConfirm={() => {
                    setIsLogoutModalOpen(false);
                    navigate("/logout");
                }}
            />
            {/* TOP NAVBAR */}
            <nav className="fixed top-0 z-40 w-full h-16 bg-gray-950 border-b border-white/5 flex items-center justify-between px-6 shadow-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400"
                    >
                        <FontAwesomeIcon icon={isSidebarOpen ? faAlignLeft : faBars} />
                    </button>
                    <span className="text-xl font-bold tracking-tighter text-indigo-500 uppercase italic">Astraea</span>
                </div>

                {/* USER DROPDOWN SECTION */}
                <div className="relative">
                    <button
                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                        className="flex items-center gap-1.5 p-1 px-2 rounded-lg hover:bg-white/5 transition-colors group"
                    >
                        <div className="flex flex-row items-center gap-2">
                            <FontAwesomeIcon icon={faUser} className="text-gray-500 text-sm" />
                            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                {username}
                            </span>
                        </div>
                        {/* Dynamic Arrow Icon */}
                        <FontAwesomeIcon
                            icon={faChevronDown}
                            className={`text-[10px] text-gray-500 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180 text-indigo-400' : ''}`}
                        />
                    </button>

                    {/* DROPDOWN MENU */}
                    {isUserMenuOpen && (
                        <>
                            {/* Invisible backdrop to close menu when clicking outside */}
                            <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>

                            <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <Link
                                    to="/profile"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    <FontAwesomeIcon icon={faUser} className="text-indigo-400 w-4" />
                                    My Profile
                                </Link>
                                <div className="border-t border-white/5"></div>
                                <button
                                    onClick={handleLogoutClick}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <FontAwesomeIcon icon={faRightFromBracket} className="text-red-400 w-4" />
                                    Logout
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </nav>

            {/* SIDEBAR */}
            <aside
                className={`fixed left-0 top-16 z-30 h-[calc(100vh-64px)] transition-all duration-300 border-r border-white/5 bg-gray-800 flex flex-col
                ${isSidebarOpen ? 'w-54' : 'w-20'}`}
            >
                {/* Subtle Inner Glow */}
                <div className="absolute inset-0 bg-linear-to-b from-indigo-500/2 to-transparent pointer-events-none" />

                <div className="relative p-3 space-y-1 flex-1 overflow-y-auto no-scrollbar">
                    <SidebarLink to="/" icon={faHouse} label="Dashboard" isOpen={isSidebarOpen} isActive={pathname === "/"} />
                    <SidebarLink to="/servers" icon={faServer} label="Servers" isOpen={isSidebarOpen} isActive={pathname === "/servers"} />
                    <SidebarLink to="/packages" icon={faCubes} label="Packages" isOpen={isSidebarOpen} isActive={pathname === "/packages"} />
                    <SidebarLink to="/reports" icon={faFileLines} label="Reports" isOpen={isSidebarOpen} isActive={pathname === "/reports"} />
                    {hasAdminAccess && (
                        <>
                            <SidebarLink
                                to="/configuration"
                                icon={faGears}
                                label="Configuration"
                                isOpen={isSidebarOpen}
                                isActive={pathname === "/configuration"}
                            />
                            <SidebarLink
                                to="/administration"
                                icon={faUsersGear}
                                label="Administration"
                                isOpen={isSidebarOpen}
                                isActive={pathname === "/administration"}
                            />
                        </>
                    )}
                </div>

                {/* Footer with Versioning */}
                <div className="relative p-4 mt-auto border-t border-white/5 bg-black/20 flex flex-col items-center justify-center gap-2">
                    {isSidebarOpen ? (
                        <div className="flex flex-col items-center animate-in fade-in duration-500">
                            <span className="text-[10px] font-mono tracking-[0.2em] text-gray-600 uppercase">
                                Astraea System
                            </span>
                            <span className="mt-1 px-2 py-0.5 rounded-full bg-gray-900 border border-white/5 text-[9px] font-bold text-indigo-500/80">
                                v{VERSION}
                            </span>
                        </div>
                    ) : (
                        <span className="px-2 py-0.5 rounded-md bg-gray-900 border border-white/5 text-[9px] font-bold text-indigo-500/80">
                            v{VERSION}
                        </span>
                    )}
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className={`pt-16 transition-all duration-300 ${isSidebarOpen ? 'pl-54' : 'pl-20'}`}>
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
};

// Simple helper component for Sidebar links
const SidebarLink = ({ to, icon, label, isOpen, isActive }) => (
    <Link to={to} className={`
        relative flex items-center p-3 rounded-xl transition-all duration-200 group
        ${isActive
            ? 'bg-indigo-500/10 text-indigo-400 shadow-[inset_0_0_12px_rgba(99,102,241,0.05)]'
            : 'text-gray-400 hover:bg-white/3 hover:text-gray-200'}
    `}>
        {/* Active Indicator Bar */}
        {isActive && (
            <div className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
        )}

        <FontAwesomeIcon
            icon={icon}
            className={`w-6 text-center transition-transform duration-200 group-hover:scale-110 
                ${isActive ? 'text-indigo-400' : 'text-gray-500 group-hover:text-indigo-300'}`}
        />

        {isOpen && (
            <span className={`ml-3 text-sm font-medium tracking-wide transition-colors
                ${isActive ? 'text-indigo-400' : 'text-gray-400 group-hover:text-gray-200'}`}>
                {label}
            </span>
        )}

        {/* Tooltip for collapsed state */}
        {!isOpen && (
            <span className="fixed left-20 scale-0 group-hover:scale-100 transition-all duration-200 origin-left 
                bg-gray-800 border border-white/10 text-indigo-400 text-xs font-bold px-3 py-2 rounded-lg shadow-2xl z-50">
                {label}
            </span>
        )}
    </Link>
);

export default Layout;