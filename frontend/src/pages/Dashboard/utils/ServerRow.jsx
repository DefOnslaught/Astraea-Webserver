import { useNavigate } from "react-router-dom";
import getDaysAgo from "../../../utils/getDaysAgo";
import getRelativeTime from "../../../utils/getRelativeTime";

const ServerRow = ({ server, type }) => {
    const navigate = useNavigate();

    return (
        <div
            onClick={() => navigate(`/inspect/${server.server_id}/`)}
            className="flex items-center justify-between p-3 hover:bg-white/3 rounded-xl transition-all duration-300 group cursor-pointer border border-transparent hover:border-white/5"
        >
            <div className="flex items-center gap-4">
                {/* Icon Container with scale effect */}
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center border transition-all duration-300 group-hover:scale-110 ${type === 'risk'
                        ? 'border-red-500/20 bg-red-500/5 group-hover:border-red-500/40'
                        : 'border-emerald-500/20 bg-emerald-500/5 group-hover:border-emerald-500/40'
                    }`}>
                    <i className={`fa-solid ${type === 'risk' ? 'fa-server text-red-400' : 'fa-circle-check text-emerald-400'
                        } text-xs group-hover:text-indigo-400 transition-colors`}></i>
                </div>

                <div className="flex flex-col relative justify-center">
                    {/* Hostname */}
                    <span className="text-sm font-semibold text-gray-400 group-hover:text-white group-hover:-translate-y-1 transition-all duration-300">
                        {server.hostname}
                    </span>

                    {/* View Details Subtext */}
                    <span className="absolute top-5 left-0 text-[10px] text-indigo-400 opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 transition-all duration-300 uppercase tracking-widest font-black whitespace-nowrap">
                        View Details <i className="fa-solid fa-arrow-right ml-1 text-[8px]"></i>
                    </span>
                </div>
            </div>

            <div className="text-right group-hover:opacity-40 transition-opacity">
                <p className="text-[11px] text-gray-500 font-medium font-mono">
                    {getDaysAgo(server.last_patch_date)}
                </p>
                <p className="text-[9px] text-gray-600 uppercase font-bold tracking-tighter">
                    {getRelativeTime(server.last_patch_date)}
                </p>
            </div>
        </div>
    );
};

export default ServerRow;