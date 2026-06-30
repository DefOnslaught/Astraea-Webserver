import { useState, useEffect } from "react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";
import { useAuth } from "../../../utils/AuthContext";
import { useNotification } from "./NotificationContext";

const EditFilterModal = ({ isOpen, filter, onClose, onRefresh }) => {
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        is_public: false,
        criteria: {},
        selected_fields: []
    });
    const [criteriaJson, setCriteriaJson] = useState("");
    const notify = useNotification();

    const { user } = useAuth();
    const hasAdminAccess = user?.is_staff || user?.is_superuser;

    useEffect(() => {
        if (filter) {
            setFormData({
                name: filter.name,
                description: filter.description || "",
                is_public: filter.is_public,
                criteria: filter.criteria,
                selected_fields: filter.selected_fields
            });
            setCriteriaJson(JSON.stringify(filter.criteria, null, 2));
        }
    }, [filter]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Parse the JSON back to an object before sending
            const parsedCriteria = JSON.parse(criteriaJson);

            const payload = {
                ...formData,
                criteria: parsedCriteria
            };

            await api.patch(`${API_ENDPOINTS.EDIT_FILTER}${filter.id}/`, payload);
            notify("success", "Filter fully updated!");
            onRefresh();
            onClose();
        } catch (error) {
            if (error instanceof SyntaxError) {
                notify("error", "Invalid JSON format in criteria.");
            } else {
                notify("error", error.response?.data?.detail || "Update failed.");
            }
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-lg border border-slate-700 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                <h2 className="text-white font-bold text-lg border-b border-slate-700 pb-2">Edit Filter: {filter.name}</h2>

                <input className="w-full bg-slate-800 p-2 text-white border border-slate-700 rounded"
                    value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Filter Name" />

                <textarea className="w-full bg-slate-800 p-2 text-white border border-slate-700 rounded"
                    value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Description" />

                <div className="space-y-1">
                    <label className="text-gray-400 text-xs font-semibold">Criteria (JSON)</label>
                    <textarea className="w-full h-32 bg-slate-800 p-2 text-white border border-slate-700 rounded font-mono text-xs"
                        value={criteriaJson} onChange={e => setCriteriaJson(e.target.value)} />
                </div>

                <div className="space-y-1">
                    <label className="text-gray-400 text-xs font-semibold">Selected Fields (Comma separated)</label>
                    <input className="w-full bg-slate-800 p-2 text-white border border-slate-700 rounded font-mono text-xs"
                        value={formData.selected_fields.join(", ")}
                        onChange={e => setFormData({ ...formData, selected_fields: e.target.value.split(",").map(s => s.trim()) })} />
                </div>

                {hasAdminAccess && (
                    <label className="flex items-center text-white text-sm gap-2">
                        <input type="checkbox" checked={formData.is_public} onChange={e => setFormData({ ...formData, is_public: e.target.checked })} />
                        Make Public
                    </label>
                )}

                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded text-xs font-bold uppercase tracking-wide bg-slate-800 hover:bg-slate-700 text-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 py-2.5 rounded text-xs font-bold uppercase tracking-wide bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                    >
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
};
export default EditFilterModal;