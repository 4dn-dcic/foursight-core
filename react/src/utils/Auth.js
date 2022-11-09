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
        return !SessionExpired();
    }
    return false;
}

function SessionExpired() {
    const authenticatedUntil = Cookie.AuthToken()?.authenticated_until;
    return authenticatedUntil && authenticatedUntil <= Math.floor(Time.Now().getTime() / 1000);
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

function LoggedInViaGoogle(header) {
    const authenticator = header?.auth?.authenticator || Cookie.AuthToken()?.authenticator;
    return authenticator === "google";
}

function LoggedInViaGitHub(header) {
    const authenticator = header?.auth?.authenticator || Cookie.AuthToken()?.authenticator;
    return authenticator === "github";
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    IsLoggedIn:        IsLoggedIn,
    LoggedInInfo:      LoggedInInfo,
    LoggedInUser:      LoggedInUser,
    LoggedInUserName:  LoggedInUserName,
    LoggedInViaGoogle: LoggedInViaGoogle,
    LoggedInViaGitHub: LoggedInViaGitHub,
    SessionExpired:    SessionExpired,
    Token:             Cookie.AuthToken
}; export default exports;
