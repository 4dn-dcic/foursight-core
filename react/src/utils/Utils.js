import uuid from 'react-uuid';

export const isObject = (value) => {
    return value != undefined && value != null && typeof value == "object";
}

export const isBoolean = (value) => {
    return value != undefined && value != null && typeof value == "boolean";
}

export const UUID = () => {
    return uuid();
}
