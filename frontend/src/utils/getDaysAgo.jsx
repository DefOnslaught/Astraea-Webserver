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

    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
    const timeStr = timeFormatter.format(date);

    const dateFormatter = new Intl.DateTimeFormat('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric'
    });
    const dateStr = dateFormatter.format(date);

    const isToday = date.toDateString() === now.toDateString();

    if (timeDifference > 0 && timeDifference < JUST_NOW_THRESHOLD) {
        return `Just Now`;
    }

    if (isToday) return `Today at ${timeStr}`;

    return `${dateStr} at ${timeStr}`;
};

export default getDaysAgo;