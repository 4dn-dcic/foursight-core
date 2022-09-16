// Miscellaneous date/time related utilities (local timezone formatting).

import STR from './STR';

// Returns a formatted date/time string based on the given date/time value (local timezone).
//
function FormatDateTime(value, verbose = false) {
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
    const tz = new Date().toLocaleDateString(undefined, {timeZoneName: "short"}).slice(-3); // timezone hack (TODO)
    return value.getFullYear() + "-" +
           ("0" + (value.getMonth() + 1)).slice(-2) + "-" +
           ("0" + value.getDate()).slice(-2) + " " +
           ("0" + value.getHours()).slice(-2) + ":" +
           ("0" + value.getMinutes()).slice(-2) + ":" +
           ("0" + value.getSeconds()).slice(-2) + " " + tz;
}

// Returns the duration between the given to date/time values.
//
function FormatDuration(startDate, endDate = new Date(), verbose = false, fallback = "", prefix = "", suffix = "") {
    if (!((startDate = ToDateTime(startDate)) instanceof Date)) return "";
    if (!((endDate   = ToDateTime(endDate))   instanceof Date)) return "";
    const msPerDay    = 86400000;
    const msPerHour   = 3600000;
    const msPerMinute = 60000;
    const msPerSecond = 1000;
    const ms          = (endDate - startDate);
    const days        = Math.floor  (ms / msPerDay);
    const hours       = Math.floor ((ms % msPerDay) / msPerHour);
    const minutes     = Math.round(((ms % msPerDay) % msPerHour)   / msPerMinute);
    const seconds     = Math.round(((ms % msPerDay) % msPerMinute) / msPerSecond);
    if (days == 0 && hours == 0 && minutes == 0 && seconds == 0) {
        if (STR.HasValue(fallback)) {
            return (prefix ? (" " + prefix + " ") : "") + fallback;
        }
        else {
            return (prefix ? " " + prefix + " " : "") + "00:00:00";
        }
    }
    if (verbose) {
        return (prefix ? " " + prefix + " " : "")
               + (days    > 0 ? days    + (days    == 1 ? " day "    : " days "   ) : "")
               + (hours   > 0 ? hours   + (hours   == 1 ? " hour "   : " hours "  ) : "")
               + (minutes > 0 ? minutes + (minutes == 1 ? " minute " : " minutes ") : "")
               + (seconds > 0 ? seconds + (seconds == 1 ? " second " : " seconds ") : "")
               + (suffix ? " " + suffix : "");
    }
    return (prefix ? " " + prefix + " " : "")
           + (days > 0 ? days + (days == 1 ? " day " : " days " ) : "")
           + (hours  .toString().padStart(2, "0") + ":")
           + (minutes.toString().padStart(2, "0") + ":")
           + (seconds.toString().padStart(2, "0"))
           + (suffix ? " " + suffix : "");
}

// Converts the give value to a JavaScript Date object.
//
function ToDateTime(value) {
    if (value instanceof Date) {
        return value;
    }
    else if (typeof(value) == 'number') {
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
    else if (STR.HasValue(value)) {
        try {
            if ((value = new Date(Date.parse(value))) == "Invalid Date") {
                return null;
            }
            return value;
        } catch {}
    }
    return null;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    FormatDuration: FormatDuration,
    FormatDateTime: FormatDateTime,
    ToDateTime: ToDateTime
}
