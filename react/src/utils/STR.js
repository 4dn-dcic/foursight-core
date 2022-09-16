// Miscellaneous string utilities.

function IsNonEmptyString(value) {
    return value != undefined && value != null && value.constructor == String && value.length > 0;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    HasValue: IsNonEmptyString
}
