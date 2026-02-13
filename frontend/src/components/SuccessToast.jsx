const SuccessToast = ({ message }) => (
    <div className="fixed top-5 right-5 z-50 animate-bounce">
        <div className="bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 border border-emerald-400">
            <i className="fa-solid fa-circle-check"></i>
            <span className="font-bold tracking-wide">{message}</span>
        </div>
    </div>
);

export default SuccessToast;