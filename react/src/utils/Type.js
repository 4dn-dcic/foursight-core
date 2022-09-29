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
    return value !== undefined && value !== null && value.constructor === Object && Object.keys(value).length > 0;
}

function CopyObject(value) {
    return IsObject(value) ? JSON.parse(JSON.stringify(value)) : {};
}

function IsArray(value) {
    return Array.isArray(value);
}

function IsNonEmptyArray(value) {
    return Array.isArray(value) && value.length > 0;
}

function IsDateTime(value) {
    return value instanceof Date;
}

function IsFunction(value) {
    return typeof value == 'function';
}

function IsNull(value) {
    return value === null || value === undefined;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    CopyObject:       CopyObject,
    IsArray:          IsArray,
    IsBoolean:        IsBoolean,
    IsDateTime:       IsDateTime,
    IsFunction:       IsFunction,
    IsNonEmptyArray:  IsNonEmptyArray,
    IsNonEmptyObject: IsNonEmptyObject,
    IsNull:           IsNull,
    IsNumber:         IsNumber,
    IsObject:         IsObject,
    IsString:         IsString
};
export default Exports;
