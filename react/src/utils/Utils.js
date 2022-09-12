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

export const FormatDateTime = (value = new Date(), long = false) => {
    if (typeof(value) == 'number') {
        if (value.toString().length < 12) {
            const seconds = value;
            value = new Date(seconds * 1000);
        }
        else {
            const milliseconds = value;
            value = new Date(milliseconds);
        }
    }
    if (long) {
        return value.toLocaleDateString('en-us', { weekday:"long",
                                                   year:"numeric",
                                                   month:"long",
                                                   day:"numeric",
                                                   hour12: false,
                                                   hour: "2-digit",
                                                   minute: "2-digit",
                                                   second: "numeric",
                                                   timeZoneName: "short"}).replace(" at ", " | ");
    }
    else {
            // TODO: Timezone hack. Find better way.
            let timezone = new Date().toLocaleDateString(undefined, {timeZoneName: "short"});
            timezone = timezone.substring(timezone.length - 3);
            return value.getFullYear() + "-" +
                   ("0" + (value.getMonth() + 1)).slice(-2) + "-" +
                   ("0" + value.getDate()).slice(-2) + " " +
                   ("0" + value.getHours()).slice(-2) + ":" +
                   ("0" + value.getMinutes()).slice(-2) + ":" +
                   ("0" + value.getSeconds()).slice(-2) + " " + timezone;
    }
}
