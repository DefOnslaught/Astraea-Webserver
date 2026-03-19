import { useMemo } from "react";

const HighlightText = ({ text, query, field }) => {
    // Return early if there's nothing to highlight or text is empty
    if (!query || !query.trim() || !text) return <span>{text}</span>;

    const relevantTerms = useMemo(() => {
        // Regex for: (key):"quoted value" OR (key):unquotedValue OR generalTerm
        const tokenRegex = /(?:(\w+):)?(?:"([^"]+)"|([^\s]+))/g;
        const terms = new Set();
        let match;

        // Reset the regex state just in case it's defined outside or reused
        tokenRegex.lastIndex = 0;

        while ((match = tokenRegex.exec(query.toLowerCase())) !== null) {
            const key = match[1]; // e.g., "ip"
            const value = match[2] || match[3]; // e.g., "10"

            if (value) {
                // HIGHLIGHT LOGIC:
                // 1. If there is no key (e.g. just searching "10"), highlight everywhere.
                // 2. If there IS a key, only highlight if it matches this component's 'field'.
                const isGeneralTerm = !key;
                const isMatchingField = key && field && key.toLowerCase() === field.toLowerCase();

                if (isGeneralTerm || isMatchingField) {
                    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    terms.add(escaped);
                }
            }
        }

        // Sort by length descending: ensures "web-01" is matched before "web"
        return Array.from(terms).sort((a, b) => b.length - a.length);
    }, [query, field]);

    const highlightRegex = useMemo(() => {
        if (relevantTerms.length === 0) return null;
        // The 'gi' flags ensure global matching and case-insensitivity
        return new RegExp(`(${relevantTerms.join('|')})`, 'gi');
    }, [relevantTerms]);

    // If no valid regex could be built, return original text
    if (!highlightRegex) return <span>{text}</span>;

    // Split the text into parts using the capturing group in the regex
    // This keeps the delimiters (the matches) in the resulting array
    const parts = text.split(highlightRegex);

    return (
        <span className="break-all">
            {parts.map((part, i) => {
                // Test if this specific part is one of the search terms
                // We use a clean match test here
                const isMatch = highlightRegex.test(part);

                // Since test() advances the lastIndex on global regexes, 
                // and we're in a loop, we reset it or rely on the fact 
                // that each part is checked individually.
                highlightRegex.lastIndex = 0;

                return isMatch ? (
                    <mark
                        key={i}
                        className="bg-indigo-500/30 text-indigo-200 rounded-sm px-0.5 border-b border-indigo-500/50 transition-colors"
                    >
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                );
            })}
        </span>
    );
};

export default HighlightText;