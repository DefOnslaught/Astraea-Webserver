const StatCard = ({ label, value, icon, loading, color, subtext, onClick, glowColor = "bg-indigo-500/5" }) => {
    return (
        <div onClick={onClick} className={`bg-gray-800/30 border border-white/5 p-6 rounded-2xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-300 ${onClick ? 'cursor-pointer active:scale-95' : ''}`}>
            <div className="flex justify-between items-start">
                <div className="z-10">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">{label}</p>
                    {loading ? (
                        <div className="h-8 w-24 bg-white/5 rounded-md animate-pulse mt-2"></div>
                    ) : (
                        <h3 className={`text-4xl font-bold ${color} tracking-tighter`}>
                            {value?.toLocaleString() || "0"}
                        </h3>
                    )}
                </div>
                <div className="p-3 rounded-xl bg-white/5 group-hover:scale-110 transition-transform duration-300">
                    <i className={`fa-solid ${icon} text-gray-500 group-hover:text-indigo-400 transition-colors`}></i>
                </div>
            </div>

            {loading ? (
                <div className="h-3 w-32 bg-white/5 rounded mt-4 animate-pulse"></div>
            ) : (
                subtext && <p className="mt-4 text-xs text-gray-500 font-medium">{subtext}</p>
            )}

            {/* Decorative background glow */}
            <div className={`absolute -right-4 -bottom-4 w-24 h-24 ${glowColor} rounded-full blur-2xl group-hover:opacity-100 transition-all`}></div>
        </div>
    );
};

export default StatCard;