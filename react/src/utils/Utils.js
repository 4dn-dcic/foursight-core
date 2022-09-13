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

export const Duration = (startDate, endDate = new Date(), long = false) => {
    startDate = ToDateTime(startDate);
    endDate = ToDateTime(endDate);
        console.log('.................')
        console.log(startDate)
        startDate = new Date(startDate);
        console.log(startDate)
        console.log(endDate)
        console.log('aaaaaaaaaaaaaaaaaa')
        console.log(typeof(endDate))
        console.log(endDate instanceof Date)
        console.log(typeof("dasfadf"))
        console.log(ToDateTime("2022-09-11"))
        console.log(typeof(ToDateTime("2022-09-11")))
    const milliseconds = (endDate - startDate);
    const days = Math.floor(milliseconds / 86400000);
    const hours = Math.floor((milliseconds % 86400000) / 3600000);
    const minutes = Math.round(((milliseconds % 86400000) % 3600000) / 60000);
    if (long) {
        const duration = (days > 0 ? days + " days " : "") + hours + " hours " + minutes + " minutes";
        return duration;
    }
    else {
        const duration = (days > 0 ? days + " days " : "") + hours + " hours " + minutes + " minutes";
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
            value = new Date(seconds * 1000);
        }
        else {
            const milliseconds = value;
            value = new Date(milliseconds);
        }
    }
    else if (isNonEmptyString(value)) {
        return new Date(Date.parse(value));
    }
    else {
        return Date();
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
