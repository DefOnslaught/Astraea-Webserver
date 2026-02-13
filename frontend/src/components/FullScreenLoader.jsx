const FullScreenLoader = ({ label = "LOADING..." }) => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-900">
            {/* The Spinner */}
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-gray-600 border-t-indigo-500"></div>

            {/* Dynamic Loading Text */}
            <p className="mt-4 text-sm font-medium text-gray-400 tracking-widest animate-pulse uppercase">
                {label}
            </p>
        </div>
    );
};

export default FullScreenLoader;