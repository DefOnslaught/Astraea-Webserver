import { useState, useEffect } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";
import { ACCESS_TOKEN } from "../constants";
import useDocumentTitle from "../utils/useDocumentTitle";

const Home = () => {
    useDocumentTitle('Home | Astraea');
    const navigate = useNavigate();
    const [timeLeft, setTimeLeft] = useState("");

    const token = localStorage.getItem(ACCESS_TOKEN);
    const decoded = token ? jwtDecode(token) : null;
    const username = decoded?.username || "Explorer";

    useEffect(() => {
        if (!decoded?.exp) return;

        const interval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const distance = decoded.exp - now;

            if (distance <= 0) {
                setTimeLeft("Expired");
                clearInterval(interval);
            } else {
                const minutes = Math.floor(distance / 60);
                const seconds = distance % 60;
                setTimeLeft(`${minutes}m ${seconds}s`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [decoded]);

    return (
        <div className="p-10 text-white bg-gray-900 min-h-screen">
            <div className="max-w-md mx-auto bg-white/5 border border-white/10 p-8 rounded-2xl">
                <h1 className="text-3xl font-bold text-indigo-400">Welcome, {username}!</h1>

                {/* Session Timer Card */}
                <div className="mt-6 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="text-xs text-indigo-300 uppercase font-bold tracking-widest">Session Expires In</p>
                        <p className="text-xl font-mono text-white">{timeLeft || "Checking..."}</p>
                    </div>
                    <i className="fa-solid fa-clock-rotate-left text-indigo-500 text-2xl"></i>
                </div>

                <button
                    onClick={() => navigate("/logout")}
                    className="mt-8 w-full py-3 bg-red-500/10 text-red-500 border border-red-500/50 rounded-lg hover:bg-red-500 hover:text-white transition-all font-semibold"
                >
                    Log Out
                </button>
            </div>
        </div>
    );
};

export default Home;