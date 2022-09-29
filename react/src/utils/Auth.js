// -------------------------------------------------------------------------------------------------
// Authentication and authorization utilities.
// Note that many of these are need the global header data as an argument.
// -------------------------------------------------------------------------------------------------

import Context from './Context';
import Cookie from './Cookie';

// -------------------------------------------------------------------------------------------------
// Authentication related functions.
// -------------------------------------------------------------------------------------------------

function IsLoggedIn(header) {
    //
    // Actually need this because we do not know that we are logged
    // in on refresh unless/until the /header is fetched.
    //
    if (header?.auth?.authorized) {
        return true;
    }
    if (Cookie.HasAuthToken()) {
        return true;
    }
    return false;
}

function LoggedInUser(header) {
    return header?.auth?.authorized ? header.auth?.user : "unknown";
}

function LoggedInUserName(header) {
    const first_name = header?.auth?.authorized ? header.auth?.first_name : "";
    const last_name = header?.auth?.authorized ? header.auth?.last_name : "";
    return first_name + " " + last_name;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    IsLoggedIn:                IsLoggedIn,
    LoggedInUser:              LoggedInUser,
    LoggedInUserName:          LoggedInUserName,
    Token:                     Cookie.AuthToken
}
