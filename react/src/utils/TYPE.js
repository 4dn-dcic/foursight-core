// -------------------------------------------------------------------------------------------------
// Miscellaneous type related functions.
// -------------------------------------------------------------------------------------------------

function IsString(value) {
    return value !== undefined && value !== null && value.constructor === String;
}

function IsBoolean(value) {
    return value !== undefined && value !== null && value.constructor === Boolean;
}

function IsNumber(value) {
    return typeof(value) == 'number';
}

function IsObject(value) {
    return value !== undefined && value !== null && value.constructor === Object;
}

function IsNonEmptyObject(value) {
    return IsObject(value) && Object.keys(value).length > 0;
}

function CopyObject(value) {
    return IsObject(value) ? JSON.parse(JSON.stringify(value)) : {};
}

function IsArray(value) {
    return Array.isArray(value);
}

function IsDateTime(value) {
    return value instanceof Date;
}

function IsNull(value) {
    return value === null || value === undefined;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    CopyObject:       CopyObject,
    IsArray:          IsArray,
    IsBoolean:        IsBoolean,
    IsDateTime:       IsDateTime,
    IsNonEmptyObject: IsNonEmptyObject,
    IsNull:           IsNull,
    IsNumber:         IsNumber,
    IsObject:         IsObject,
    IsString:         IsString
}
