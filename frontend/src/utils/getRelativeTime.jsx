/**
 * Calculates the difference between a target date and the current time.
 * @param {string|Date} dateString - ISO string or Date object.
 * @param {boolean} returnString - If true, returns "Today", "Yesterday", or "X days ago".
 * @returns {number|string} - The integer days ago or a formatted string.
 */
const getRelativeTime = (dateString, returnString = true) => {
    // 1. Handle "Never" / Null cases
    if (!dateString || dateString === "Never") return "Never";

    const date = new Date(dateString);
    const now = new Date();

    // 2. Validate Date Object
    if (isNaN(date.getTime())) return "Invalid Date";

    // 3. Normalize to Calendar Days (Midnight)
    // This ensures that 11:59 PM yesterday vs 12:01 AM today is correctly 1 day.
    const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 4. Calculate Difference
    const diffInMs = endDate - startDate;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    // 5. Future Date Safety
    // If the server clock is slightly ahead, treat it as "Today"
    if (diffInDays < 0) return returnString ? "Today" : 0;

    // 6. Conditional Return Logic
    if (!returnString) return diffInDays;

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "1 day ago";

    return `${diffInDays.toLocaleString()} days ago`;
};

export default getRelativeTime;