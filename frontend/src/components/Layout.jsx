import { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { useAuth } from "../utils/AuthContext";
import { usePathCheck } from "../hooks/usePathCheck";
import LogoutModal from "./LogoutModal";
 
function Layout({ children }) {
    const { user, isAuthorized, loading } = useAuth();
    const { isAuthPage, pathname } = usePathCheck();
    const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
        return localStorage.getItem("sidebarOpen") !== "false";
    });
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    
    const username = user?.username || "User";

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
            <nav className="fixed top-0 z-40 w-full h-16 bg-gray-900 border-b border-white/5 flex items-center justify-between px-6 shadow-md">
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleSidebar}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400"
                    >
                        <i className={`fa-solid ${isSidebarOpen ? 'fa-align-left' : 'fa-bars'}`}></i>
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
                            <i className="fa-solid fa-user text-gray-500 text-sm"></i>
                            <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
                                {username}
                            </span>
                        </div>
                        {/* Dynamic Arrow Icon */}
                        <i className={`fa-solid fa-chevron-down text-[10px] text-gray-500 transition-transform duration-300 ${isUserMenuOpen ? 'rotate-180 text-indigo-400' : ''}`}></i>
                    </button>

                    {/* DROPDOWN MENU */}
                    {isUserMenuOpen && (
                        <>
                            {/* Invisible backdrop to close menu when clicking outside */}
                            <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)}></div>

                            <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                <Link
                                    to="/profile"
                                    onClick={() => setIsUserMenuOpen(false)}
                                    className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    <i className="fa-solid fa-user text-indigo-400 w-4"></i>
                                    My Profile
                                </Link>
                                <div className="border-t border-white/5"></div>
                                <button
                                    onClick={handleLogoutClick}
                                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <i className="fa-solid fa-right-from-bracket w-4"></i>
                                    Logout
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </nav>

            {/* SIDEBAR */}
            <aside
                className={`fixed left-0 top-16 z-30 h-[calc(100vh-64px)] transition-all duration-300 border-r border-white/5 bg-gray-900
                ${isSidebarOpen ? 'w-54' : 'w-20'}`}
            >
                <div className="p-2 space-y-2">
                    <SidebarLink to="/" icon="fa-house" label="Dashboard" isOpen={isSidebarOpen} isActive={pathname === "/"} />
                    <SidebarLink to="/servers" icon="fa-server" label="Servers" isOpen={isSidebarOpen} isActive={pathname === "/servers"} />
                    <SidebarLink to="/packages" icon="fa-cubes" label="Packages" isOpen={isSidebarOpen} isActive={pathname === "/packages"} />
                    <SidebarLink to="/configuration" icon="fa-gears" label="Configuration" isOpen={isSidebarOpen} isActive={pathname === "/configuration"} />
                </div>

                <div className="p-4 border-t border-white/5 flex justify-center items-center">
                    <span className={`text-[10px] font-mono tracking-widest text-gray-600 transition-opacity duration-300`}>
                        v1.0.0
                    </span>
                    
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
    <Link to={to} className={`flex items-center p-3 rounded-lg hover:bg-white/5 group transition-colors`}>
        <i className={`fa-solid ${icon} w-6 text-center ${isActive ? 'text-indigo-400' : 'text-gray-300'}`}></i>
        {!isOpen && (
            <span className="fixed left-20 scale-0 group-hover:scale-100 transition-all duration-200 origin-left bg-indigo-600 text-gray-300 text-xs font-bold px-2 py-1 rounded shadow-xl pointer-events-none">
                {label}
            </span>
        )}
        {isOpen && <span className={`ml-3 text-sm font-medium transition-colors ${isActive ? 'text-indigo-400' : 'text-gray-300'}`}>{label}</span>}
    </Link>
);

export default Layout;