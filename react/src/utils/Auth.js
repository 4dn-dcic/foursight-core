// -------------------------------------------------------------------------------------------------
// Authentication and authorization utilities.
// Note that many of these are need the global header data as an argument.
// -------------------------------------------------------------------------------------------------

import Cookie from './Cookie';
import Time from './Time';

// -------------------------------------------------------------------------------------------------
// Authentication related functions.
// -------------------------------------------------------------------------------------------------

function IsLoggedIn(header) {
    //
    // Actually need this because we do not know that we are logged
    // in on refresh unless/until the /header is fetched.
    //
    if (header?.auth?.authenticated) {
        return true;
    }
    if (Cookie.HasAuthToken()) {
        if (Cookie.AuthToken().authenticated_until <= Time.Now()) {
            return false;
        }
        return true;
    }
    return false;
}

function LoggedInInfo(header) {
    return header?.auth || Cookie.AuthToken();
}

function LoggedInUser(header) {
    return header?.auth?.user || Cookie.AuthToken()?.user || "unknown";
}

function LoggedInUserName(header) {
    const first_name = header.auth?.first_name || Cookie.AuthToken()?.user || "";
    const last_name = header.auth?.last_name || Cookie.AuthToken()?.user || "";
    return first_name + " " + last_name;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    IsLoggedIn:       IsLoggedIn,
    LoggedInInfo:     LoggedInInfo,
    LoggedInUser:     LoggedInUser,
    LoggedInUserName: LoggedInUserName,
    Token:            Cookie.AuthToken
};
export default Exports;
