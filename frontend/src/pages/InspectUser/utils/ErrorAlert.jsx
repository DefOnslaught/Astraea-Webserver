import { AlertTriangle, X } from "lucide-react";

const ErrorAlert = ({ message, onClose }) => (
    <div className="mb-6 flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <p className="text-sm font-medium text-red-200">{message}</p>
        </div>
        <button
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-lg transition-colors text-red-500/50 hover:text-red-500"
        >
            <X className="w-5 h-5" />
        </button>
    </div>
);

export default ErrorAlert;