import { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

const ErrorToast = ({ message, onClose, duration = 4000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 p-4 bg-red-950/90 border border-red-500/40 backdrop-blur-md rounded-xl text-red-200 text-sm font-medium shadow-2xl max-w-md w-full animate-in fade-in slide-in-from-top-4 duration-300 shake">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <div className="flex-1 pr-2">{message}</div>
            <button
                onClick={onClose}
                className="text-red-400 hover:text-red-200 p-1 hover:bg-white/5 rounded-md transition-all shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default ErrorToast;