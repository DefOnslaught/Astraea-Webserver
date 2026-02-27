import { useAuth } from "../utils/AuthContext";
import useDocumentTitle from "../utils/useDocumentTitle";

const Home = () => {
    useDocumentTitle('Home | Astraea');
    
    const { user, formattedTime } = useAuth();
    
    const username = user?.username || "Explorer";

    return (
        <div className="max-w-4xl mx-auto">
            <div className="max-w-md mx-auto bg-white/5 border border-white/10 p-8 rounded-2xl">
                <h1 className="text-3xl font-bold text-indigo-400">
                    Welcome, {user?.username || "Explorer"}!
                </h1>

                {/* Session Timer Card */}
                <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="text-xs text-indigo-300 uppercase font-bold tracking-widest">
                            Token Expires In
                        </p>
                        <p className="text-xl font-mono text-white">
                            {formattedTime}
                        </p>
                    </div>
                    <i className="fa-solid fa-clock-rotate-left text-indigo-500 text-2xl"></i>
                </div>

                <p className="mt-6 text-gray-400 text-sm italic border-t border-white/10 pt-4">
                    <span className="text-indigo-400 font-bold">Security Note:</span> Your session uses
                    <span className="text-white"> HttpOnly cookies</span>. The timer above shows the
                    lifetime of your current access token. It will auto-refresh seamlessly
                    before it reaches zero.
                </p>
            </div>
        </div>
    );
};

export default Home;