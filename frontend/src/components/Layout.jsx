function Layout({ children }) {
    return (
        <>
            <div className="min-h-screen bg-gray-900 flex flex-col">
                {children}
            </div>
        </>
    );
}

export default Layout;