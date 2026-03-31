import { useState, useEffect } from "react";
import { Search, Loader2, UserPlus } from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";
import UserRow from "./UserRow";
import CreateUserModal from "./CreateUserModal";
import AccessForbidden from "../../ErrorPages/AccessForbidden";

const UserManagement = ({ onNotify }) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showForbidden, setShowForbidden] = useState(false);

    const fetchUsers = async () => {
        try {
            const res = await api.get(API_ENDPOINTS.FETCH_USERS);
            if (res.status === 200) {
                setUsers(res.data);
            }
        } catch (err) {
            if (err.response?.status === 403) {
                setShowForbidden(true);
            } else {
                console.error("Failed to fetch", err); 
            }
        }
        finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { 
        fetchUsers(); 
    }, []);

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;

    if (showForbidden) return <AccessForbidden isEmbedded={true} />

    return (

        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Registered Users</h2>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2"
                >
                    <UserPlus className="w-4 h-4" /> Create New User
                </button>
            </div>

            <div className="space-y-6">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                </div>

                <div className="bg-gray-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-white/5 text-gray-500 uppercase text-[10px] font-bold tracking-wider">
                                <th className="px-6 py-4">User Details</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Permissions</th>
                                <th className="px-6 py-4">Last Activity</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredUsers.map((user) => (
                                <UserRow key={user.id} user={user} onRefresh={fetchUsers} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <CreateUserModal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(msg) => {
                    onNotify(msg);
                    fetchUsers();
                }}
            />
        </div>
    );
};

export default UserManagement;