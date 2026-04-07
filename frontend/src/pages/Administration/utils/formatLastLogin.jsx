/**
 * Formats a date into a highly accurate relative string (e.g., "5 mins ago", "2 hours ago").
 * @param {string|Date} dateString 
 * @returns {string}
 */
export const formatLastLogin = (dateString) => {
    if (!dateString || dateString === "Never") return "Never";

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    // 1. Just now / Seconds
    if (diffInSeconds < 60) return "Just now";

    // 2. Minutes
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

    // 3. Hours
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;

    // 4. Fallback to days if more than 24 hours
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "Yesterday";

    return `${diffInDays} days ago`;
};

export default formatLastLogin;