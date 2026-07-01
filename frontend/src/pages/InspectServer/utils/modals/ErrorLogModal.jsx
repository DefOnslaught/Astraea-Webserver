import { X, AlertTriangle, Copy, Check } from 'lucide-react';
import { useState } from 'react';

const ErrorLogModal = ({ errorLog, sessionTimestamp, onClose }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(errorLog);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = errorLog;

                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                textArea.style.top = "0";
                document.body.appendChild(textArea);

                textArea.focus();
                textArea.select();

                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);

                if (!successful) throw new Error("Fallback copy failed");
            }

            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    };

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                {/* Header: More refined UI */}
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-500 border border-red-500/20">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-100">System Error Log</h3>
                            <p className="text-sm text-slate-500 font-mono mt-1">
                                {new Date(sessionTimestamp).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-md transition-all"
                        >
                            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copied ? "Copied" : "Copy Log"}
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Log Area: "Terminal" style */}
                <div className="flex-1 overflow-auto p-0 bg-slate-950">
                    <pre className="p-6 text-xs text-red-200/80 font-mono leading-relaxed whitespace-pre-wrap selection:bg-red-900/50 selection:text-white">
                        {errorLog || "No error logs available for this session."}
                    </pre>
                </div>

                {/* Footer status bar */}
                <div className="px-6 py-2 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-600 font-mono uppercase flex justify-end">
                    <span>Format: Plaintext/UTF-8</span>
                </div>
            </div>
        </div>
    );
};

export default ErrorLogModal;