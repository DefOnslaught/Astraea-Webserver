import { useAuth } from "../utils/AuthContext";
import useDocumentTitle from "../utils/useDocumentTitle";

const Home = () => {
    useDocumentTitle('Home | Astraea');
    
    const { user } = useAuth();
    
    const username = user?.username || "Explorer";

    return (
        <div className="max-w-4xl mx-auto">
            <div className="max-w-md mx-auto bg-white/5 border border-white/10 p-8 rounded-2xl">
                <h1 className="text-3xl font-bold text-indigo-400">Welcome, {username}!</h1>

                <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="text-xs text-indigo-300 uppercase font-bold tracking-widest">Account Email</p>
                        <p className="text-xl font-mono text-white">{user?.email || "Loading..."}</p>
                    </div>
                    <i className="fa-solid fa-user-shield text-indigo-500 text-2xl"></i>
                </div>

                <p className="mt-4 text-sm text-gray-500 italic">
                    Note: Session timing is now handled securely via HttpOnly cookies.
                </p>
            </div>
        </div>
    );
};

export default Home;