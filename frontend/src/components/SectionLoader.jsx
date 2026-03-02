const SectionLoader = ({ label = "LOADING..." }) => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] w-full animate-in fade-in duration-500">

            {/* The Spinner - matching your FullScreen style but slightly smaller */}
            <div className="relative">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/5 border-t-indigo-500"></div>
                {/* Optional: Add a subtle glow effect to match Astraea theme */}
                <div className="absolute inset-0 h-12 w-12 blur-xl bg-indigo-500/20 rounded-full"></div>
            </div>

            {/* Dynamic Loading Text */}
            <p className="mt-6 text-[10px] font-bold text-gray-500 tracking-[0.3em] animate-pulse uppercase">
                {label}
            </p>
        </div>
    );
};

export default SectionLoader;