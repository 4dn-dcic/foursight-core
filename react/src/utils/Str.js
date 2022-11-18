// -------------------------------------------------------------------------------------------------
// Miscellaneous string related functions.
// -------------------------------------------------------------------------------------------------

function IsNonEmptyString(value) {
    return value !== undefined && value !== null && value.constructor === String && value.length > 0;
}

function FormatBytes(bytes, decimals = 2) {
    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    let i = 0; for (i; bytes > 1024; i++) bytes /= 1024;
    return parseFloat(bytes.toFixed(decimals)) + ' ' + units[i];
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    HasValue: IsNonEmptyString,
    FormatBytes: FormatBytes
}; export default exports;
