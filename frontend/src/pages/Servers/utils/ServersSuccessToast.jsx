import { useEffect } from "react";
import { createPortal } from "react-dom";

const ServersSuccessToast = ({ message, onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [onClose, duration]);

    return createPortal(
        <div className="fixed top-20 right-5 z-50 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 border border-emerald-400">
                <i className="fa-solid fa-circle-check"></i>
                <span className="font-bold tracking-wide">{message}</span>
                {/* Manual close button (optional) */}
                <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity">
                    <i className="fa-solid fa-xmark text-sm"></i>
                </button>
            </div>
        </div>,
        document.body
    );
};

export default ServersSuccessToast;