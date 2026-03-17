const ListSkeleton = () => (
    <div className="space-y-2 p-2">
        {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 w-full bg-white/5 rounded-xl animate-pulse"></div>
        ))}
    </div>
);

export default ListSkeleton;