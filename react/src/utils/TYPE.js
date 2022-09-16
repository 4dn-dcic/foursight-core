// Miscellaneous type related utilities.

function IsString(value) {
    return value != undefined && value != null && value.constructor == String;
}

function IsBoolean(value) {
    //return value != undefined && value != null && typeof value == "boolean";
    return value != undefined && value != null && value.constructor == Boolean;
}

function IsObject(value) {
    return value != undefined && value != null && value.constructor == Object;
}

function IsDateTime(value) {
    return value instanceof Date;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    IsBoolean: IsBoolean,
    IsDateTime: IsDateTime,
    IsObject: IsObject,
    IsString: IsString
}