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

function IsInteger(value) {
    return Number.isInteger(value);
}

function IsNull(value) {
    return value === null || value === undefined;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    IsArray:          IsArray,
    IsBoolean:        IsBoolean,
    IsDateTime:       IsDateTime,
    IsFunction:       IsFunction,
    IsInteger:        IsInteger,
    IsNonEmptyArray:  IsNonEmptyArray,
    IsNonEmptyObject: IsNonEmptyObject,
    IsNull:           IsNull,
    IsNumber:         IsNumber,
    IsObject:         IsObject,
    IsString:         IsString
};
export default Exports;
