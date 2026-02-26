import { useEffect } from "react";

const LogoutModal = ({ isOpen, onConfirm, onCancel }) => {
    
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.keyCode === 27) onCancel();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onCancel]);
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                <div className="flex items-center gap-4 text-red-500 mb-4">
                    <div className="bg-red-500/10 p-3 rounded-full">
                        <i className="fa-solid fa-right-from-bracket text-xl"></i>
                    </div>
                    <h3 className="text-xl font-bold text-white">Sign Out?</h3>
                </div>

                <p className="text-gray-400 text-sm mb-6">
                    Are you sure you want to log out? You will need to sign back in to access your data.
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold transition-all shadow-lg shadow-red-500/20"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogoutModal;