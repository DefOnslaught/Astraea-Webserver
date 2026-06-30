import { createContext, useContext, useState } from "react";

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);

    const notify = (type, message) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 4000);
    };

    return (
        <NotificationContext.Provider value={notify}>
            {children}
            {notification && (
                <div className={`fixed top-5 right-5 z-100 p-4 rounded shadow-lg border ${notification.type === 'error' ? 'bg-red-900 border-red-700 text-red-100' : 'bg-green-900 border-green-700 text-green-100'
                    }`}>
                    {notification.message}
                </div>
            )}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);