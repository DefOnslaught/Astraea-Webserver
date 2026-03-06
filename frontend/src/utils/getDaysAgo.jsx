/**
 * Formats a date string into a human-readable relative or absolute format.
 * Examples: "Just Now", "Today at 2:30 PM", "12/14/2026 at 6:45 PM"
 */
const getDaysAgo = (dateString) => {
    if (!dateString) return "Never";

    const date = new Date(dateString);
    const now = new Date();

    // Validate Date Object
    if (isNaN(date.getTime())) return "Invalid Date";

    const JUST_NOW_THRESHOLD = 3 * 60 * 1000; // 3 minutes
    const timeDifference = now - date;

    // 1. Define Time Formatter (e.g., "2:30 PM")
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
    const timeStr = timeFormatter.format(date);

    // 2. Define Date Formatter (e.g., "12/14/2026")
    // We use 'short' to keep the dashboard table clean
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric'
    });
    const dateStr = dateFormatter.format(date);

    // 3. Logic for Relative Labels
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    // 4. Determine Return String
    if (timeDifference > 0 && timeDifference < JUST_NOW_THRESHOLD) {
        return `Just Now`;
    }

    if (isToday) return `Today at ${timeStr}`;
    if (isYesterday) return `Yesterday at ${timeStr}`;

    // Calculate diff in days for recent history (1-7 days ago)
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // For items between 2 and 7 days ago
    if (diffDays >= 1 && diffDays <= 7) {
        return `${diffDays} days ago`;
    }

    // Default: Full absolute date for anything older than a week
    // Format: "MM/DD/YYYY at HH:MM AM/PM"
    return `${dateStr} at ${timeStr}`;
};

export default getDaysAgo;