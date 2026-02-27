import { useAuth } from "../utils/AuthContext";
import useDocumentTitle from "../utils/useDocumentTitle";

const Home = () => {
    useDocumentTitle('Home | Astraea');
    const { user, formattedTime, isSyncing, checkAuth } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="w-full max-w-md bg-gray-900/50 border border-white/10 p-8 rounded-2xl backdrop-blur-sm">
                <h1 className="text-3xl font-bold text-indigo-400 mb-2 text-center">
                    Welcome, <span className="text-indigo-400">{user?.username}</span>
                </h1>

                <div className="mt-8 p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-xl relative overflow-hidden">
                    {/* Syncing overlay */}
                    {isSyncing && (
                        <div className="absolute inset-0 bg-indigo-500/10 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="h-4 w-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}

                    <div className="flex flex-col items-center">
                        <p className="text-[10px] text-indigo-300 uppercase font-black tracking-[0.2em] mb-2">
                            Session Life
                        </p>
                        <p className={`text-4xl font-mono transition-colors duration-500 ${isSyncing ? 'text-indigo-300' : 'text-white'}`}>
                            {formattedTime}
                        </p>
                    </div>
                </div>

                {/* THE UPDATED NOTE SECTION */}
                <div className="mt-8 space-y-3">
                    <p className="text-gray-400 text-xs leading-relaxed text-center">
                        <span className="text-indigo-400 font-bold block mb-1">AUTOMATIC REFRESH ACTIVE</span>
                        When the timer reaches zero, Astraea will automatically attempt to renew your security
                        credentials via the refresh token.
                    </p>

                    <button
                        onClick={checkAuth}
                        disabled={isSyncing}
                        className="w-full py-2 text-[10px] font-bold text-gray-500 hover:text-indigo-400 transition-colors uppercase tracking-widest"
                    >
                        {isSyncing ? "Syncing with server..." : "Sync Timer Now"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Home;