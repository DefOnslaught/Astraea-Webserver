const TableSkeleton = () => (
    <>
        {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="animate-pulse">
                <td colSpan="7" className="px-6 py-4">
                    <div className="h-12 bg-white/5 rounded-xl w-full"></div>
                </td>
            </tr>
        ))}
    </>
);

export default TableSkeleton;