import { useState, useEffect, useRef } from "react";
import api from "../../../utils/api";
import { API_ENDPOINTS } from "../../../utils/constants";
import { Play, AlertCircle, ChevronDown, Check, Plus, Trash2, Code } from "lucide-react";
import SuccessToast from "../../../components/SuccessToast";

const ReportControls = ({ onRefresh, setReports, activeFilter, clearActiveFilter }) => {
    const [availableFields, setAvailableFields] = useState([]);
    const [selectedFields, setSelectedFields] = useState(["hostname", "env"]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [filterRows, setFilterRows] = useState([{ field: "env", operator: "icontains", value: "prod" }]);
    const usedFields = filterRows.map(row => row.field).filter(f => f !== "");
    const getAvailableOptions = (currentIndex) => {
        return availableFields.filter(f =>
            !usedFields.includes(f) || filterRows[currentIndex].field === f
        );
    };
    const [showSuccess, setShowSuccess] = useState(false);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        file_name: "",
        only_latest_session: true,
        save_filter: false,
        filter_name: "",
        filter_description: ""
    });
    const dropdownRef = useRef(null);

    useEffect(() => {
        api.get(API_ENDPOINTS.GET_AVAILABLE_FIELDS)
            .then(res => setAvailableFields(res.data.sort()))
            .catch(err => console.error("Failed to load fields", err));
    }, []);

    useEffect(() => {
        if (activeFilter) {
            const knownOperators = ['icontains', 'gt', 'lt', 'gte', 'lte', 'exact'];

            const rows = Object.entries(activeFilter.criteria)
                .filter(([key]) => key !== 'only_latest_session')
                .map(([key, value]) => {
                    let fieldName = key;
                    let operator = 'exact';

                    const sortedOps = [...knownOperators].sort((a, b) => b.length - a.length);

                    for (const op of sortedOps) {
                        if (key.endsWith(`__${op}`)) {
                            fieldName = key.slice(0, -(op.length + 2));
                            operator = op;
                            break;
                        }
                    }

                    return {
                        field: fieldName,
                        operator: operator,
                        value: value
                    };
                });

            setFilterRows(rows.length > 0 ? rows : [{ field: "", operator: "exact", value: "" }]);
            setFormData(prev => ({
                ...prev,
                only_latest_session: activeFilter.criteria.only_latest_session ?? true
            }));

            if (activeFilter.selected_fields) {
                setSelectedFields(activeFilter.selected_fields);
            }
        } else {
            setFilterRows([{ field: "env", operator: "icontains", value: "prod" }]);
            setSelectedFields(["hostname", "env"]);
            setFormData({
                file_name: "",
                only_latest_session: true,
                save_filter: false,
                filter_name: ""
            });
            setShowAdvanced(false);
        }
    }, [activeFilter]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

    const getCriteriaObject = () => {
        const criteria = {};
        filterRows.forEach(row => {
            if (row.field && row.value !== "") {
                let key = row.field;

                const isDynamic = typeof row.value === 'string' && /^[><]=?/.test(row.value.trim());

                if (row.operator !== 'exact' && !isDynamic) {
                    key = `${row.field}__${row.operator}`;
                }

                criteria[key] = row.value;
            }
        });
        return { ...criteria, only_latest_session: formData.only_latest_session };
    };

    const addFilterRow = () => setFilterRows([...filterRows, { field: "", operator: "exact", value: "" }]);

    const updateFilterRow = (index, key, val) => {
        const newRows = [...filterRows];
        newRows[index][key] = val;
        setFilterRows(newRows);
    };

    const removeFilterRow = (index) => setFilterRows(filterRows.filter((_, i) => i !== index));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const res = await api.post(API_ENDPOINTS.CREATE_QUERY, {
                file_name: formData.file_name || null,
                criteria: getCriteriaObject(),
                selected_fields: selectedFields,
                save_filter: formData.save_filter,
                filter_name: formData.save_filter ? formData.filter_name : "",
                filter_description: formData.save_filter ? formData.filter_description : ""
            });

            setReports(prev => [{
                id: res.data.report_id,
                status: 'pending',
                created_at: new Date().toISOString(),
                file_name: formData.file_name || "New Report"
            }, ...prev]);

            setShowSuccess(true);
            onRefresh();
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (err) {
            setError(err.response?.data?.error || "Failed to schedule report.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-slate-900 p-6 rounded-lg border border-slate-700 space-y-6">
            {showSuccess && <SuccessToast message="Report compilation scheduled!" />}
            <h2 className="text-xl font-bold text-white">Report Generator</h2>

            {activeFilter && (
                <div className="bg-blue-900/30 border border-blue-700 p-3 rounded flex justify-between items-center text-sm text-blue-200">
                    <span>Using Filter: <strong>{activeFilter.name}</strong></span>
                    <button type="button" onClick={clearActiveFilter} className="text-blue-400 hover:text-white underline">Clear</button>
                </div>
            )}

            <input
                placeholder="File Name (Optional)"
                className="w-full bg-slate-800 border border-slate-700 p-2.5 rounded text-white"
                value={formData.file_name}
                onChange={(e) => setFormData({ ...formData, file_name: e.target.value })}
            />

            <div className="relative">
                <div className="relative" ref={dropdownRef}>
                    <button
                        type="button"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full flex justify-between items-center bg-slate-800 border border-slate-700 p-2.5 rounded text-white"
                    >
                        {selectedFields.length} columns selected <ChevronDown size={16} />
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded shadow-2xl max-h-48 overflow-y-auto p-1">
                            {availableFields.map(f => (
                                <div
                                    key={f}
                                    onClick={() => setSelectedFields(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])}
                                    className="flex items-center gap-2 p-2 hover:bg-slate-700 cursor-pointer text-sm text-white"
                                >
                                    <div className={`w-4 h-4 border rounded ${selectedFields.includes(f) ? 'bg-blue-600' : 'border-slate-500'}`}>
                                        {selectedFields.includes(f) && <Check size={12} />}
                                    </div> {f}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-400">Filters</label>
                    <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-blue-400 flex items-center gap-1 hover:text-blue-300">
                        <Code size={12} /> {showAdvanced ? "Hide JSON" : "Advanced JSON"}
                    </button>
                </div>

                {!showAdvanced ? (
                    <div className="space-y-2">
                        {filterRows.map((row, idx) => (
                            <div key={idx} className="flex gap-2">
                                <select
                                    className="bg-slate-800 border border-slate-700 text-white p-2 rounded text-xs w-1/3"
                                    onChange={(e) => updateFilterRow(idx, 'field', e.target.value)}
                                    value={row.field}
                                >
                                    <option value="">Select Field</option>
                                    {availableFields.map(f => (
                                        <option
                                            key={f}
                                            value={f}
                                            disabled={usedFields.includes(f) && row.field !== f}
                                        >
                                            {f}
                                        </option>
                                    ))}
                                </select>
                                <select className="bg-slate-800 border border-slate-700 text-white p-2 rounded text-xs w-1/4" onChange={(e) => updateFilterRow(idx, 'operator', e.target.value)} value={row.operator}>
                                    <option value="exact">Exact / Dynamic</option>
                                    <option value="icontains">Contains</option>
                                    <option value="gt">Greater Than</option>
                                    <option value="lt">Less Than</option>
                                </select>
                                <input
                                    className="bg-slate-800 border border-slate-700 text-white p-2 rounded text-xs flex-1"
                                    placeholder='Value (e.g. "prod", ">30d")'
                                    onChange={(e) => updateFilterRow(idx, 'value', e.target.value)}
                                    value={row.value}
                                />
                                <button type="button" onClick={() => removeFilterRow(idx)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        <button type="button" disabled={usedFields.length >= availableFields.length} onClick={addFilterRow} className="text-xs text-green-400 flex items-center gap-1"><Plus size={12} /> Add Filter</button>
                    </div>
                ) : (
                    <textarea
                        className="w-full h-24 bg-slate-800 border border-slate-700 p-3 rounded text-white font-mono text-xs"
                        value={JSON.stringify(getCriteriaObject(), null, 2)}
                        readOnly
                    />
                )}
            </div>

            <div className="space-y-3 border-t border-slate-700 pt-4">
                <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input type="checkbox" checked={formData.only_latest_session} onChange={(e) => setFormData({ ...formData, only_latest_session: e.target.checked })} />
                    Only include latest patch session
                </label>

                <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input type="checkbox" checked={formData.save_filter} onChange={(e) => setFormData({ ...formData, save_filter: e.target.checked })} />
                    Save as named filter
                </label>

                {formData.save_filter && (
                    <div className="space-y-2">
                        <input
                            placeholder="Filter Name"
                            className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-sm"
                            value={formData.filter_name}
                            onChange={(e) => setFormData({ ...formData, filter_name: e.target.value })}
                        />
                        <textarea
                            placeholder="Filter Description (Optional)"
                            className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-white text-sm h-20"
                            value={formData.filter_description}
                            onChange={(e) => setFormData({ ...formData, filter_description: e.target.value })}
                        />
                    </div>
                )}

                <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold transition-colors">
                    {loading ? "Generating..." : "Generate Report"}
                </button>
            </div>
        </form>
    );
};
export default ReportControls;