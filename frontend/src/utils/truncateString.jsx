const truncateString = (str, maxLength) => {
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...";
};

export default truncateString;