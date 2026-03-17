import getDaysAgo from "../../../utils/getDaysAgo";

const ServerRow = ({ server, type }) => (
    <div className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition-colors group">
        <div className="flex items-center gap-4">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center border ${type === 'risk' ? 'border-red-500/20 bg-red-500/5' : 'border-emerald-500/20 bg-emerald-500/5'
                }`}>
                <i className={`fa-solid ${type === 'risk' ? 'fa-server text-red-400' : 'fa-circle-check text-emerald-400'} text-xs`}></i>
            </div>
            <div>
                <p className="text-sm font-semibold text-white group-hover:text-indigo-400 transition-colors">{server.hostname}</p>
                <p className="text-[10px] text-gray-500 font-mono">{server.ip_address}</p>
            </div>
        </div>

        <div className="text-right">
            <p className="text-[11px] text-gray-400 font-medium">
                {getDaysAgo(server.last_patch_date)}
            </p>
            <p className="text-[9px] text-gray-600 uppercase font-bold tracking-tighter">
                {type === 'risk' ? 'Status' : 'Last Patch'}
            </p>
        </div>
    </div>
);

export default ServerRow;