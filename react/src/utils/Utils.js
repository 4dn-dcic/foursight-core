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

export const Duration = (startDate, endDate = new Date(), long = false, prefix = "", suffix = "", fallback = "") => {
    if (!((startDate = ToDateTime(startDate)) instanceof Date)) {
        return "";
    }
    if (!((endDate = ToDateTime(endDate)) instanceof Date)) {
        return "";
    }
        startDate = new Date(startDate);
    const millisecondsPerDay = 86400000;
    const millisecondsPerHour = 3600000;
    const millisecondsPerMinute = 60000;
    const millisecondsPerSecond = 1000;
    const milliseconds = (endDate - startDate);
    const days = Math.floor(milliseconds / millisecondsPerDay);
    const hours = Math.floor((milliseconds % millisecondsPerDay) / millisecondsPerHour);
    const minutes = Math.round(((milliseconds % millisecondsPerDay) % millisecondsPerHour) / millisecondsPerMinute);
    const seconds = Math.round(((milliseconds % millisecondsPerDay) % millisecondsPerMinute) / millisecondsPerSecond);
    if (long) {
        if (days == 0 && hours == 0 && minutes == 0 && seconds == 0) {
            return (prefix ? " " + prefix + " " : "") + fallback;
        }
        const duration = (prefix ? " " + prefix + " " : "")
                       + (days    > 0 ? days    + (days    == 1 ? " day "    : " days "   ) : "")
                       + (hours   > 0 ? hours   + (hours   == 1 ? " hour "   : " hours "  ) : "")
                       + (minutes > 0 ? minutes + (minutes == 1 ? " minute " : " minutes ") : "")
                       + (seconds > 0 ? seconds + (seconds == 1 ? " second " : " seconds ") : "")
                       + (suffix ? " " + suffix : "");
        return duration;
    }
    else {
        if (days == 0 && hours == 0 && minutes == 0 && seconds == 0) {
            return (prefix ? " " + prefix + " " : "") + fallback;
        }
        const duration = (prefix ? " " + prefix + " " : "")
                       + (days > 0 ? days + (days == 1 ? " day " : " days " ) : "")
                       + (hours  .toString().padStart(2, "0") + ":")
                       + (minutes.toString().padStart(2, "0") + ":")
                       + (seconds.toString().padStart(2, "0"))
                       + (suffix ? " " + suffix : "");
        return duration;
    }
}

export const ToDateTime = (value) => {
    if (value instanceof Date) {
        return value;
    }
    else if (typeof(value) == 'number') {
        if (value.toString().length < 12) {
            const seconds = value;
            return new Date(seconds * 1000);
        }
        else {
            const milliseconds = value;
            return new Date(milliseconds);
        }
    }
    else if (isNonEmptyString(value)) {
        return new Date(Date.parse(value));
    }
    else {
        return new Date();
    }
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
                                                   hour12: true,
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
