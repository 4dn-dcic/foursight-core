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

function IsJson(value) {
    return IsObject(value) || IsArray(value);
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

// Returns the first value in the given array which is of a type
// specified by the given ofType function.
//
function FirstOfType(values, ofType) {
    for (const value of values) {
        if (ofType(value)) {
            return value;
        }
    }
    return null;
}

// Copies any properties from the given fromArray to the given toArray, in-place.
// Originally written for the _update function Fetch.js when updating an array state,
// where we do it like [...fromArray] which will not pick up any properties of the
// fromArray, e.g. "hidden" properties like the "__sort" property we use in TableHead.js.
// Returns the toArray for convenience (but as said properties are copied into it in-place).
//
function CopyArrayProperties(fromArray, toArray) {
    if (!Array.isArray(toArray)) {
        return undefined;
    }
    if (Array.isArray(fromArray)) {
        const nproperties = Object.keys(fromArray).length - fromArray.length;
        if (nproperties > 0) {
            for (let i = 0 ; i < nproperties ; i++) {
                const name = Object.keys(fromArray)[fromArray.length - i];
                toArray[name] = fromArray[name];
            }
        }
    }
    return toArray;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    CopyArrayProperties: CopyArrayProperties,
    First:               FirstOfType,
    IsArray:             IsArray,
    IsBoolean:           IsBoolean,
    IsDateTime:          IsDateTime,
    IsFunction:          IsFunction,
    IsInteger:           IsInteger,
    IsJson:              IsJson,
    IsNonEmptyArray:     IsNonEmptyArray,
    IsNonEmptyObject:    IsNonEmptyObject,
    IsNull:              IsNull,
    IsNumber:            IsNumber,
    IsObject:            IsObject,
    IsString:            IsString
}; export default exports;
