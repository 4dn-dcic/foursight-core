// Miscellaneous utilities.

function IsString(value) {
    return value != undefined && value != null && value.constructor == String;
}

function IsEmptyString(value) {
    return value != undefined && value != null && value.constructor == String && value.length == 0;
}

function IsNonEmptyString(value) {
    return value != undefined && value != null && value.constructor == String && value.length > 0;
}

function IsBoolean(value) {
    return value != undefined && value != null && typeof value == "boolean";
}

function IsObject(value) {
    return value != undefined && value != null && typeof value == "object";
}

export default {
    IsBoolean: IsBoolean,
    IsEmptyString: IsEmptyString,
    IsNonEmptyString: IsNonEmptyString,
    IsObject: IsObject,
    IsString: IsString,
}
