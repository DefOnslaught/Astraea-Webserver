import { useState, useEffect } from "react";
import { Download, Trash2, FileSearch } from "lucide-react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";
import { useNotification } from "./NotificationContext";
import ConfirmationModal from "./ConfirmationModal";

const ReportTable = ({ reports, onRefresh }) => {
    const [modalData, setModalData] = useState({ isOpen: false, id: null });
    const notify = useNotification();
    
    useEffect(() => {
        const hasPending = reports.some(r => r.status === 'pending' || r.status === 'processing');
        if (!hasPending) return;

        const interval = setInterval(async () => {
            let needsRefresh = false;

            await Promise.all(reports
                .filter(r => r.status === 'pending' || r.status === 'processing')
                .map(async (report) => {
                    try {
                        const res = await api.get(`${API_ENDPOINTS.CHECK_REPORT}${report.id}/`);
                        if (res.data.status === 'completed') {
                            needsRefresh = true;
                        }
                    } catch (err) {
                        console.error("Polling error", err);
                    }
                })
            );

            if (needsRefresh) {
                onRefresh();
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [reports, onRefresh]);

    const download = async (id) => {
        try {
            const response = await api.get(`${API_ENDPOINTS.DOWNLOAD_REPORT}${id}/`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;

            const contentDisposition = response.headers['content-disposition'];
            let fileName = `report_${id}.csv`;

            if (contentDisposition) {
                const fileNameMatch = contentDisposition.match(/filename\*?=['"]?(?:UTF-8'')?([^;"\n\r]+)['"]?/i);
                if (fileNameMatch && fileNameMatch.length >= 2) {
                    fileName = decodeURIComponent(fileNameMatch[1]);
                }
            }

            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();

            // Clean up
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            notify("error", error.response?.data?.error || "Failed to download report.");
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete(`${API_ENDPOINTS.DELETE_REPORT}${modalData.id}/`);
            notify("success", "Report deleted successfully.");
            onRefresh();
        } catch (error) {
            notify("error", error.response?.data?.error || "Failed to delete report.");
        } finally {
            setModalData({ isOpen: false, id: null });
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "-";
        return new Date(dateString).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <>
            <div className="bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
                <table className="w-full text-left text-gray-300">
                    <thead className="bg-slate-800 uppercase text-xs">
                        <tr>
                            <th className="p-4 text-left">Report Name</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Created</th>
                            <th className="p-4">Updated</th>
                            <th className="p-4">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.length > 0 ? (
                            reports.map(r => (
                                <tr key={r.id} className="border-t border-slate-700">
                                    <td className="p-4 text-sm text-white">
                                        {r.file_name || `Report ${r.id.slice(0, 8)}`}
                                    </td>
                                    <td className="p-4 capitalize">
                                        <span className={`px-2 py-1 rounded text-xs ${r.status === 'completed' ? 'bg-green-900 text-green-300' : 'bg-blue-900 text-blue-300'}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-xs text-gray-400 font-mono">
                                        {formatDate(r.created_at)}
                                    </td>
                                    <td className="p-4 text-xs text-gray-400 font-mono">
                                        {formatDate(r.updated_at)}
                                    </td>
                                    <td className="p-4 flex gap-3 items-center">
                                        {r.status === 'completed' && (
                                            <button
                                                onClick={() => download(r.id)}
                                                className="text-gray-300 hover:text-blue-400"
                                                title="Download Report"
                                            >
                                                <Download size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setModalData({ isOpen: true, id: r.id })}
                                            className="text-gray-300 hover:text-red-500"
                                            title="Delete Report"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <td colSpan="5" className="p-12 text-center text-gray-500">
                                <div className="flex flex-col items-center gap-3">
                                    <FileSearch size={32} className="opacity-50" />
                                    <p className="text-sm">No report requests available.</p>
                                </div>
                            </td>
                        )}
                    </tbody>
                </table>
            </div>
            
            <ConfirmationModal
                isOpen={modalData.isOpen}
                title="Delete Report"
                message="Are you sure you want to delete this report? This action cannot be undone."
                onConfirm={handleDelete}
                onCancel={() => setModalData({ isOpen: false, id: null })}
            />
        </>
    );
};
export default ReportTable;