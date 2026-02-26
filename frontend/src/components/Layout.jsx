import { useState } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { ACCESS_TOKEN } from "../utils/constants";
import LogoutModal from "./LogoutModal";
 
function Layout({ children }) {

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const location = useLocation();

    // Check if user is logged in
    const token = localStorage.getItem(ACCESS_TOKEN);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const navigate = useNavigate();
    let username = "User";

    if (token) {
        try {
            const decoded = jwtDecode(token);
            username = decoded.username;
        } catch (e) {
            console.error("Invalid Token");
        }
    }

    // Don't show Nav/Sidebar on Login or Register pages
    const isAuthPage = ["/login", "/register", "/logout"].includes(location.pathname);

    if (isAuthPage) {
        return <div className="min-h-screen bg-gray-900">{children}</div>;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <LogoutModal
                isOpen={isLogoutModalOpen}
                onCancel={() => setIsLogoutModalOpen(false)}
                onConfirm={() => {
                    setIsLogoutModalOpen(false);
                    navigate("/logout");
                }}
            />
            {/* TOP NAVBAR */}
            <nav className="fixed top-0 z-40 w-full h-16 bg-gray-900 border-b border-white/10 flex items-center justify-between px-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400"
                    >
                        <i className={`fa-solid ${isSidebarOpen ? 'fa-align-left' : 'fa-bars'}`}></i>
                    </button>
                    <span className="text-xl font-bold tracking-tighter text-indigo-500 uppercase">Astraea</span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-400">{username}</span>
                    <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold uppercase">
                        {username[0]}
                    </div>
                </div>
            </nav>

            {/* SIDEBAR */}
            <aside
                className={`fixed left-0 top-16 z-30 h-[calc(100vh-64px)] transition-all duration-300 border-r border-white/10 bg-gray-900/50 backdrop-blur-xl
                ${isSidebarOpen ? 'w-64' : 'w-20'}`}
            >
                <div className="p-4 space-y-2">
                    <SidebarLink to="/" icon="fa-house" label="Home" isOpen={isSidebarOpen} />
                    <SidebarLink to="/profile" icon="fa-user" label="Profile" isOpen={isSidebarOpen} />
                    {/* UPDATED LOGOUT BUTTON: Note we use a button instead of a Link here */}
                    <button
                        onClick={() => setIsLogoutModalOpen(true)}
                        className="w-full flex items-center p-3 rounded-lg hover:bg-white/5 group transition-colors"
                    >
                        <i className="fa-solid fa-right-from-bracket text-red-400 w-6 text-center"></i>
                        {isSidebarOpen && <span className="ml-3 text-sm font-medium text-gray-300 group-hover:text-white">Logout</span>}
                    </button>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main
                className={`pt-16 transition-all duration-300 ${isSidebarOpen ? 'pl-64' : 'pl-20'}`}
            >
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
};

// Simple helper component for Sidebar links
const SidebarLink = ({ to, icon, label, isOpen, color = "text-gray-400" }) => (
    <Link to={to} className={`flex items-center p-3 rounded-lg hover:bg-white/5 group transition-colors`}>
        <i className={`fa-solid ${icon} ${color} w-6 text-center`}></i>
        {isOpen && <span className="ml-3 text-sm font-medium text-gray-300 group-hover:text-white">{label}</span>}
    </Link>
);

export default Layout;