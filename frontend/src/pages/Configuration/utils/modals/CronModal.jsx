import { createPortal } from "react-dom";
import { X, Clock, Zap, ArrowRight, ExternalLink, Copy, Check } from "lucide-react";
import { useState, useEffect } from "react";
import cronstrue from "cronstrue";

const CronModal = ({ currentValue, onSave, onClose }) => {
    const [tempValue, setTempValue] = useState(currentValue || "* * * * *");
    const [explanation, setExplanation] = useState("");
    const [isValid, setIsValid] = useState(true);
    const [copied, setCopied] = useState(false);

    const presets = [
        { name: "Hourly", value: "0 * * * *" },
        { name: "Daily", value: "0 0 * * *" },
        { name: "Weekly", value: "0 0 * * 0" },
        { name: "Monthly", value: "0 0 1 * *" },
    ];

    const handleCopy = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(tempValue);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            } else {
                // Fallback for non-HTTPS or older browsers
                const textArea = document.createElement("textarea");
                textArea.value = tempValue;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                if (successful) {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                }
            }
        } catch (err) {
            setError("Failed to copy to clipboard.");
            console.error('Clipboard error:', err);
        }
    };

    // Lock background scrolling
    useEffect(() => {
        const originalStyle = window.getComputedStyle(document.body).overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalStyle;
        };
    }, []);

    useEffect(() => {
        // Sanitize: collapse spaces
        const cleanValue = tempValue.trim().replace(/\s+/g, ' ');
        const partsCount = cleanValue.split(' ').length;

        // Basic structural validation before calling cronstrue
        if (partsCount < 5 || partsCount > 6) {
            setExplanation("Expression must be 5 or 6 parts");
            setIsValid(false);
            return;
        }

        try {
            // cronstrue is very reliable for validation + explanation
            const desc = cronstrue.toString(cleanValue, {
                use24HourTimeFormat: false,
                throwExceptionOnParseError: true
            });

            setExplanation(desc);
            setIsValid(true);
        } catch (err) {
            setExplanation("Invalid cron syntax");
            setIsValid(false);
        }
    }, [tempValue]);

    const parts = tempValue.trim().split(/\s+/);
    const labels = [
        { name: "minute", range: "0-59" },
        { name: "hour", range: "0-23" },
        { name: "day (m)", range: "1-31" },
        { name: "month", range: "1-12" },
        { name: "day (w)", range: "0-6" },
    ];

    return createPortal(
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f111a] border border-white/10 w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col transition-all">

                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-indigo-500/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                            <Clock className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-lg">Schedule Guru</h3>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Cron Expression Editor</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-8 space-y-8 overflow-y-auto max-h-[85vh] custom-scrollbar">

                    {/* Explanation Card */}
                    <div className={`relative p-6 rounded-3xl border-2 transition-all duration-500 ${isValid ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-red-500/5 border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]'}`}>
                        <div className="absolute -top-3 left-6 px-3 bg-[#0f111a] flex items-center gap-2">
                            <Zap className={`w-3 h-3 ${isValid ? 'text-indigo-400' : 'text-red-400'}`} />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Human Readable</span>
                        </div>
                        <p className={`text-xl font-medium text-center leading-relaxed transition-colors ${isValid ? 'text-white' : 'text-red-400 italic'}`}>
                            “{explanation}”
                        </p>
                    </div>

                    {/* Input Section */}
                    <div className="space-y-4">
                        <div className="relative group">
                            <input
                                type="text"
                                value={tempValue}
                                onChange={(e) => setTempValue(e.target.value)}
                                className={`w-full bg-black/40 border rounded-2xl px-6 py-6 text-white font-mono text-3xl tracking-[0.2em] outline-none transition-all text-center shadow-inner ${isValid ? 'border-white/10 focus:border-indigo-500/50' : 'border-red-500/30 focus:border-red-500/50'}`}
                                placeholder="* * * * *"
                            />
                            <button
                                onClick={handleCopy}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                            >
                                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Column Labels */}
                        <div className="grid grid-cols-5 gap-2 px-2">
                            {labels.map((lbl, idx) => (
                                <div key={lbl.name} className="text-center group">
                                    <div className={`h-1.5 rounded-full mb-2 transition-all duration-500 ${parts[idx] && parts[idx] !== '*' ? 'bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]' : 'bg-gray-800'}`} />
                                    <p className={`text-[9px] font-bold uppercase transition-colors ${parts[idx] && parts[idx] !== '*' ? 'text-indigo-400' : 'text-gray-600'}`}>
                                        {lbl.name}
                                    </p>
                                    <p className="text-[8px] text-gray-700 font-mono mt-1 font-bold">{lbl.range}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Presets Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {presets.map(p => (
                            <button
                                key={p.value}
                                onClick={() => setTempValue(p.value)}
                                className={`py-4 rounded-2xl border text-center transition-all ${tempValue === p.value ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-900/20' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                            >
                                <p className={`text-[11px] font-bold ${tempValue === p.value ? 'text-white' : 'text-gray-400'}`}>{p.name}</p>
                                <p className={`text-[9px] mt-1 font-mono ${tempValue === p.value ? 'text-indigo-200' : 'text-gray-600'}`}>{p.value}</p>
                            </button>
                        ))}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col sm:flex-row gap-4 items-center border-t border-white/5 pt-6">
                        <a
                            href={`https://crontab.guru/#${tempValue.replace(/\s+/g, '_')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 group cursor-pointer"
                        >
                            <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-indigo-500/20 transition-all border border-transparent group-hover:border-indigo-500/30">
                                <ExternalLink className="w-4 h-4 text-gray-500 group-hover:text-indigo-400" />
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-bold text-gray-400 group-hover:text-white transition-colors">Advanced Assistance</p>
                                <p className="text-[9px] text-gray-600 font-medium">Open crontab.guru</p>
                            </div>
                        </a>

                        <div className="flex gap-3 ml-auto w-full sm:w-auto">
                            <button onClick={onClose} className="px-6 py-3.5 rounded-xl bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10 transition-all">
                                Cancel
                            </button>
                            <button
                                disabled={!isValid}
                                onClick={() => { onSave(tempValue); onClose(); }}
                                className="px-8 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/40 disabled:opacity-30 disabled:cursor-not-allowed group"
                            >
                                Set Schedule <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CronModal;