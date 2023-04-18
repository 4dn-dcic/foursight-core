// -------------------------------------------------------------------------------------------------
// Miscellaneous date/time related functions (local timezone formatting).
// 
// TODO
// Comment from Kent: Do these match the ones that are in dcicutils.lang_utils?
// It'd be nice as a theory of design if we had some conversational alignment
// on operations that might happen on either side.
// -------------------------------------------------------------------------------------------------

import Str from './Str';

function now() {
    return new Date();
}

// Returns a formatted date/time string based on the given date/time value (local timezone).
//
function FormatDateTime(value, verbose = false, timezone = true) {
    if (!(value = ToDateTime(value))) return "";
    if (verbose) {
        let format = { weekday:"long",
                       year:"numeric",
                       month:"long",
                       day:"numeric",
                       hour12: true,
                       hour: "numeric",
                       minute: "2-digit",
                       second: "numeric" };
        if (timezone) {
            format = { ...format, timeZoneName: "short" };
        }
        return value.toLocaleDateString('en-us', format).replace(" at ", " | ");
    }
    const tz = now().toLocaleDateString(undefined, {timeZoneName: "short"}).slice(-3); // timezone hack (TODO)
    return value.getFullYear() + "-" +
           ("0" + (value.getMonth() + 1)).slice(-2) + "-" +
           ("0" + value.getDate()).slice(-2) + " " +
           ("0" + value.getHours()).slice(-2) + ":" +
           ("0" + value.getMinutes()).slice(-2) + ":" +
           ("0" + value.getSeconds()).slice(-2) + " " + tz;
}

// Returns the duration between the given to date/time values.
//
function FormatDuration(startDate, endDate = now(), verbose = false, fallback = "", prefix = "", suffix = "", include_seconds = true) {
    if (!((startDate = ToDateTime(startDate)) instanceof Date)) return "";
    if (!((endDate   = ToDateTime(endDate))   instanceof Date)) return "";
    const msPerDay    = 86400000;
    const msPerHour   = 3600000;
    const msPerMinute = 60000;
    const msPerSecond = 1000;
    const ms          = endDate >= startDate ? (endDate - startDate) : (startDate - endDate);
    const days        = Math.floor  (ms / msPerDay);
    const hours       = Math.floor ((ms % msPerDay) / msPerHour);
    const minutes     = Math.floor(((ms % msPerDay) % msPerHour)   / msPerMinute);
    const seconds     = Math.round(((ms % msPerDay) % msPerMinute) / msPerSecond);
    const negative    = endDate < startDate;
    if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
        if (Str.HasValue(fallback)) {
            return (prefix ? (" " + prefix + " ") : "") + fallback;
        }
        else {
            return (prefix ? " " + prefix + " " : "") + "00:00:00";
        }
    }
    if (verbose) {
        return (prefix ? " " + prefix + " " : "")
               + (negative ? "MINUS " : "")
               + (days    > 0 ? days    + (days    === 1 ? " day "    : " days "   ) : "")
               + (hours   > 0 ? hours   + (hours   === 1 ? " hour "   : " hours "  ) : "")
               + (minutes > 0 ? minutes + (minutes === 1 ? " minute " : " minutes ") : "")
               + (include_seconds ? (seconds > 0 ? seconds + (seconds === 1 ? " second " : " seconds ") : "") : "")
               + (suffix ? " " + suffix : "");
    }
    return (prefix ? " " + prefix + " " : "")
           + (negative ? "MINUS " : "")
           + (days > 0 ? days + (days === 1 ? " day " : " days " ) : "")
           + (hours.toString().padStart(2, "0") + ":")
           + (minutes.toString().padStart(2, "0") + ":")
           + (include_seconds ? (seconds.toString().padStart(2, "0")) : "")
           + (suffix ? " " + suffix : "");
}

function Ago(date, verbose = true, include_seconds = true) {
    return FormatDuration(date, now(), verbose, null, null, "ago", include_seconds);
}

function FromNow(date, verbose = true, include_seconds = true) {
    return FormatDuration(now(), date, verbose, null, null, "from now", include_seconds);
}

// Converts the give value to a JavaScript Date object.
//
function ToDateTime(value) {
    if (value instanceof Date) {
        return value;
    }
    else if (typeof(value) === 'number') {
        //
        // If number assume it is an "epoch" number,
        // and detect if it is in seconds or milliseconds.
        //
        if (value.toString().length < 12) {
            const seconds = value;
            return new Date(seconds * 1000);
        }
        else {
            const ms = value;
            return new Date(ms);
        }
    }
    else if (Str.HasValue(value)) {
        let originalValue = value;
        try {
            if ((value = new Date(Date.parse(value))) === "Invalid Date") {
                return null;
            }
            if (isNaN(value)) {
                //
                // Address bug with Safari not parsing dates with timezone like: 2022-11-27 14:40:54 EDT
                // https://stackoverflow.com/questions/6427204/date-parsing-in-javascript-is-different-between-safari-and-chrome
                //
                value = new Date(Date.parse(originalValue.replace(/-/g, '/').replace(/[a-z]+/gi, ' ')));
            }
            return value;
        } catch {}
    }
    return null;
}

function FormatDate(value, verbose = false) {
    if (!(value = ToDateTime(value))) return "";
    if (verbose) {
        return value.toLocaleDateString('en-us', { weekday:"long",
                                                   year:"numeric",
                                                   month:"long",
                                                   day:"numeric" });
    }
    return value.getFullYear() + "-" +
           ("0" + (value.getMonth() + 1)).slice(-2) + "-" +
           ("0" + value.getDate()).slice(-2);
}

function FormatTime(value, verbose = false) {
    if (!(value = ToDateTime(value))) return "";
    if (verbose) {
        return value.toLocaleDateString('en-us', { weekday:"long",
                                                   year:"numeric",
                                                   month:"long",
                                                   day:"numeric",
                                                   hour12: true,
                                                   hour: "numeric",
                                                   minute: "2-digit",
                                                   second: "numeric",
                                                   timeZoneName: "short"}).replace(" at ", " | ");
    }
    const tz = now().toLocaleDateString(undefined, {timeZoneName: "short"}).slice(-3); // timezone hack (TODO)
    return ("0" + value.getHours()).slice(-2) + ":" +
           ("0" + value.getMinutes()).slice(-2) + ":" +
           ("0" + value.getSeconds()).slice(-2) + " " + tz;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    Ago:            Ago,
    FormatDuration: FormatDuration,
    FormatDateTime: FormatDateTime,
    FormatDate:     FormatDate,
    FormatTime:     FormatTime,
    FromNow:        FromNow,
    ToDateTime:     ToDateTime,
    Now:            () => now()
}; export default exports;
