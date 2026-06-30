import { useState } from "react";
import { Trash2, Edit2, Shield, User, Play } from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";
import { useNotification } from "./NotificationContext";
import ConfirmationModal from "./ConfirmationModal";
import EditFilterModal from "./EditFilterModal";
import { useAuth } from "../../../utils/AuthContext";

const FilterList = ({ filters, onRefresh, onSelect }) => {
    const [modalData, setModalData] = useState({ isOpen: false, id: null });
    const [editModal, setEditModal] = useState({ isOpen: false, filter: null });
    const notify = useNotification();
    const { user } = useAuth();
    const username = user?.username || "User";
    const hasAdminAccess = user?.is_staff || user?.is_superuser;

    const confirmDelete = (id) => {
        setModalData({ isOpen: true, id });
    };

    const personalFilters = filters.filter(f => f.user__username === username);
    const publicFilters = filters.filter(f => f.is_public && f.user__username !== username);

    const handleDelete = async () => {
        try {
            await api.delete(`${API_ENDPOINTS.DELETE_FILTER}${modalData.id}/`);
            notify("success", "Filter deleted successfully.");
            onRefresh();
        } catch (error) {
            notify("error", error.response?.data?.error || "Failed to delete filter.");
        } finally {
            setModalData({ isOpen: false, id: null });
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">Saved Filters</h2>

            <ConfirmationModal 
                isOpen={modalData.isOpen}
                title="Delete Filter"
                message="Are you sure you want to delete this filter? This action cannot be undone."
                onConfirm={handleDelete}
                onCancel={() => setModalData({ isOpen: false, id: null })}
            />

            <EditFilterModal
                isOpen={editModal.isOpen}
                filter={editModal.filter}
                onClose={() => setEditModal({ isOpen: false, filter: null })}
                onRefresh={onRefresh}
            />

            <div className="space-y-8">
                {/* Personal Section */}
                <div>
                    <h3 className="text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">My Filters</h3>
                    {personalFilters.length > 0 ? (
                        personalFilters.map(filter => (
                            <FilterItem
                                key={filter.id} filter={filter} onSelect={onSelect}
                                confirmDelete={confirmDelete} setEditModal={setEditModal}
                                username={username} hasAdminAccess={hasAdminAccess}
                            />
                        ))
                    ) : (
                        <p className="text-gray-500 text-sm italic">No personal filters saved.</p>
                    )}
                </div>

                {/* Public Section */}
                <div>
                    <h3 className="text-sm font-semibold text-yellow-500 uppercase tracking-wider mb-3">Public Filters</h3>
                    {publicFilters.length > 0 ? (
                        publicFilters.map(filter => (
                            <FilterItem
                                key={filter.id} filter={filter} onSelect={onSelect}
                                confirmDelete={confirmDelete} setEditModal={setEditModal}
                                username={username} hasAdminAccess={hasAdminAccess}
                            />
                        ))
                    ) : (
                        <p className="text-gray-500 text-sm italic">No public filters available.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

const FilterItem = ({ filter, onSelect, confirmDelete, setEditModal, username, hasAdminAccess }) => (
    <div className="bg-slate-800 p-4 rounded border border-slate-700 hover:border-blue-500 transition-colors mb-3">
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-2">
                {filter.is_public ? <Shield size={14} className="text-yellow-500" /> : <User size={14} className="text-blue-400" />}
                <h3 className="text-white font-medium">{filter.name}</h3>
            </div>
            <div className="flex gap-2">
                <button onClick={() => onSelect(filter)} className="text-blue-400 hover:text-blue-300" title="Select Filter">
                    <Play size={16} />
                </button>
                {(username === filter.user__username || hasAdminAccess) && (
                    <div className="flex gap-2">
                        <button onClick={() => setEditModal({ isOpen: true, filter })} className="text-gray-400 hover:text-white" title="Edit Filter">
                            <Edit2 size={16} />
                        </button>
                        <button onClick={() => confirmDelete(filter.id)} className="text-gray-400 hover:text-red-500" title="Delete Filter">
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
        <p className="text-xs text-gray-500 mt-2 truncate">
            {filter.description?.trim() ? filter.description : `Criteria: ${JSON.stringify(filter.criteria)}`}
        </p>
    </div>
);

export default FilterList;