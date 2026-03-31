import { useNavigate } from "react-router-dom";
import useDocumentTitle from "../../utils/useDocumentTitle";
import { ShieldAlert } from "lucide-react";

const AccessForbidden = ({ isEmbedded = false }) => {
    useDocumentTitle('403 - Access Forbidden | Astraea');
    const navigate = useNavigate();

    const containerClasses = isEmbedded
        ? "relative w-full py-20 flex flex-col justify-center items-center text-center bg-gray-900/50 border border-white/5 rounded-2xl overflow-hidden"
        : "flex min-h-screen flex-col justify-center items-center px-6 lg:px-8 text-center relative overflow-hidden";

    return (
        <div className={containerClasses}>
            <div className="relative mb-4">
                <ShieldAlert className="w-12 h-12 text-indigo-500/20 absolute -top-4 -left-4 animate-pulse" />
            </div>

            <h1 className="text-3xl mt-10 font-bold tracking-tight text-white sm:text-5xl">
                Access Forbidden
            </h1>

            <p className="mt-4 text-gray-400 max-w-md mx-auto text-sm sm:text-base px-6">
                Your account does not have the necessary administrative privileges to view or manage this page.
            </p>

            <div className="mt-10 flex items-center justify-center gap-x-4">
                <button
                    onClick={() => navigate("/")}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 transition-all"
                >
                    Return Home
                </button>

                {!isEmbedded && (
                    <button
                        onClick={() => window.history.back()}
                        className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                    >
                        Go Back
                    </button>
                )}
            </div>

            <div className="absolute -z-10 blur-3xl opacity-10 pointer-events-none">
                <div className="h-64 w-64 bg-indigo-500 rounded-full"></div>
            </div>
        </div>
    );
};

export default AccessForbidden;