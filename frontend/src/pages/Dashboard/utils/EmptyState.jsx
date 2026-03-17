const EmptyState = ({ message }) => (
    <div className="flex flex-col items-center justify-center py-12">
        <i className="fa-solid fa-folder-open text-gray-700 text-2xl mb-2"></i>
        <p className="text-xs text-gray-500">{message}</p>
    </div>
);

export default EmptyState;