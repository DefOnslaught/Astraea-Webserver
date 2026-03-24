import { createPortal } from "react-dom";
import { X, Clock, Zap, Info, HelpCircle } from "lucide-react";
import { useState, useEffect } from "react";
import cronstrue from "cronstrue";

const CronModal = ({ currentValue, onSave, onClose }) => {
    const [tempValue, setTempValue] = useState(currentValue);
    const [explanation, setExplanation] = useState("");
    const [isValid, setIsValid] = useState(true);

    const presets = [
        { name: "Hourly", value: "0 * * * *", desc: "Top of every hour" },
        { name: "Daily", value: "0 0 * * *", desc: "Midnight every day" },
        { name: "Weekly", value: "0 0 * * 0", desc: "Sundays at midnight" },
        { name: "Business Hours", value: "0 9-17 * * 1-5", desc: "Hourly 9-5, Mon-Fri" },
    ];

    useEffect(() => {
        try {
            const desc = cronstrue.toString(tempValue, { use24HourTimeFormat: false });
            setExplanation(desc);
            setIsValid(true);
        } catch (err) {
            setExplanation("Invalid cron expression");
            setIsValid(false);
        }
    }, [tempValue]);

    // Helper to visualize which part of the string represents what
    const parts = tempValue.split(" ");

    return createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-white/10 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-500/5">
                    <div>
                        <h3 className="text-white font-bold text-lg flex items-center gap-2">
                            <Clock className="w-5 h-5 text-indigo-400" /> Schedule Assistant
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">Translate machine logic to human time</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto">

                    {/* Natural Language Preview */}
                    <div className={`p-5 rounded-2xl border transition-all duration-300 ${isValid ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                        <div className="flex items-center gap-3 mb-2">
                            <Zap className={`w-4 h-4 ${isValid ? 'text-indigo-400' : 'text-red-400'}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Current Behavior</span>
                        </div>
                        <p className={`text-sm font-medium leading-relaxed ${isValid ? 'text-white' : 'text-red-400 italic'}`}>
                            {explanation}
                        </p>
                    </div>

                    {/* Presets Grid */}
                    <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase mb-4 block tracking-widest">Rapid Presets</label>
                        <div className="grid grid-cols-2 gap-3">
                            {presets.map(p => (
                                <button
                                    key={p.value}
                                    onClick={() => setTempValue(p.value)}
                                    className={`p-4 rounded-xl border text-left transition-all ${tempValue === p.value ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-600/20' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                                >
                                    <p className={`text-xs font-bold ${tempValue === p.value ? 'text-white' : 'text-gray-300'}`}>{p.name}</p>
                                    <p className={`text-[10px] mt-1 ${tempValue === p.value ? 'text-indigo-100' : 'text-gray-500'}`}>{p.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Visual Editor */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Expression Editor</label>
                            <a href="https://crontab.guru" target="_blank" rel="noreferrer" className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1">
                                <HelpCircle className="w-3 h-3" /> Syntax Guide
                            </a>
                        </div>

                        <div className="relative group">
                            <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-white font-mono text-lg tracking-[0.2em] focus:border-indigo-500 outline-none transition-all text-center"
                                placeholder="* * * * *"
                            />
                        </div>

                        {/* Position Legend */}
                        <div className="grid grid-cols-5 gap-1 text-center">
                            {['Min', 'Hour', 'Day', 'Mon', 'Week'].map((label, idx) => (
                                <div key={label} className="flex flex-col gap-1">
                                    <span className={`text-[9px] font-bold uppercase ${parts[idx] && parts[idx] !== '*' ? 'text-indigo-400' : 'text-gray-600'}`}>
                                        {label}
                                    </span>
                                    <div className={`h-1 rounded-full ${parts[idx] && parts[idx] !== '*' ? 'bg-indigo-500' : 'bg-gray-800'}`} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pro Tip */}
                    <div className="bg-white/5 rounded-xl p-4 flex gap-3">
                        <Info className="w-4 h-4 text-gray-500 shrink-0" />
                        <p className="text-[10px] text-gray-500 leading-normal">
                            Use commas for multiple values (e.g., <code className="text-gray-300">1,3</code>) or dashes for ranges (e.g., <code className="text-gray-300">1-5</code>).
                            The last column represents day of week (0 is Sunday).
                        </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-400 text-xs font-bold uppercase hover:bg-white/10 transition-all">
                            Discard
                        </button>
                        <button
                            disabled={!isValid}
                            onClick={() => { onSave(tempValue); onClose(); }}
                            className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl text-xs font-bold uppercase hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Save Schedule
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CronModal;