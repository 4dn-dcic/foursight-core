// Miscellaneous string utilities.

function IsEmptyString(value) {
    return value != undefined && value != null && value.constructor == String && value.length == 0;
}

function IsNonEmptyString(value) {
    return value != undefined && value != null && value.constructor == String && value.length > 0;
}

export default {
    IsEmpty: IsEmptyString,
    IsNonEmpty: IsNonEmptyString
}
