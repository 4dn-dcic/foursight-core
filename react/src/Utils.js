export const isString = (value) => {
    return value != undefined && value != null && value.constructor == String;
}

export const isNonEmptyString = (value) => {
    return value != undefined && value != null && value.constructor == String && value.length > 0;
}

export const isObject = (value) => {
    return value != undefined && value != null && typeof value == "object";
}
