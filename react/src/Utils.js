import uuid from 'react-uuid';

export const isString = (value) => {
    return value != undefined && value != null && value.constructor == String;
}

export const isEmptyString = (value) => {
    return value == undefined || value == null || value.constructor != String || value.length <= 0;
}

export const isNonEmptyString = (value) => {
    return value != undefined && value != null && value.constructor == String && value.length > 0;
}

export const isObject = (value) => {
    return value != undefined && value != null && typeof value == "object";
}

export const isBoolean = (value) => {
    return value != undefined && value != null && typeof value == "boolean";
}

export const isRunningLocally = () => {
    return window.origin?.startsWith("http://localhost:");
}

export const CopyToClipboard = (id) => {
        console.log("COPY")
        console.log(id)
    const r = document.createRange();
    if (r) {
        r.selectNode(document.getElementById(id));
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(r);
        document.execCommand('copy');
        window.getSelection().removeAllRanges();
    }
}

export const UUID = () => {
    return uuid();
}
