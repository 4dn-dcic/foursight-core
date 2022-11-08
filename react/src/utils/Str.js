// -------------------------------------------------------------------------------------------------
// Miscellaneous string related functions.
// -------------------------------------------------------------------------------------------------

function IsNonEmptyString(value) {
    return value !== undefined && value !== null && value.constructor === String && value.length > 0;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    HasValue: IsNonEmptyString
}; export default exports;
