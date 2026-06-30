import { useState, useEffect } from "react";
import api from "../../utils/api";
import { API_ENDPOINTS } from "../../utils/constants";
import { NotificationProvider } from "./utils/NotificationContext";
import ReportControls from "./utils/ReportControls";
import ReportTable from "./utils/ReportTable";
import FilterList from "./utils/FilterList";

const Reports = () => {

    const [filters, setFilters] = useState([]);
    const [reports, setReports] = useState([]);
    const [activeFilter, setActiveFilter] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [filterRes, reportRes] = await Promise.all([
                api.get(API_ENDPOINTS.GET_FILTERS),
                api.get(API_ENDPOINTS.FINISHED_REPORTS)
            ]);

            setFilters(filterRes.data);

            setReports(prevReports => {
                const pendingReports = prevReports.filter(r => r.status === 'pending');
                const serverReports = reportRes.data;

                const combined = [...serverReports];
                pendingReports.forEach(p => {
                    if (!combined.find(s => s.id === p.id)) {
                        combined.unshift(p);
                    }
                });
                return combined;
            });
        } catch (error) {
            console.error("Failed to load dashboard", error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchData(); }, []);

    return (
        <NotificationProvider>
            <div className="p-3 space-y-8 animate-in fade-in duration-500">
                <header>
                    <h1 className="text-3xl font-bold text-white">Report Generation</h1>
                    <p className="text-gray-400">Manage infrastructure filters and extract system insights.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <ReportControls onRefresh={fetchData} setReports={setReports} activeFilter={activeFilter} clearActiveFilter={() => setActiveFilter(null)} />
                        <ReportTable reports={reports} onRefresh={fetchData} />
                    </div>
                    <div className="lg:col-span-1">
                        <FilterList filters={filters} onRefresh={fetchData} onSelect={setActiveFilter} />
                    </div>
                </div>
            </div>
        </NotificationProvider>
    );
};
export default Reports;