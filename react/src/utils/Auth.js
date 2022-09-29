// -------------------------------------------------------------------------------------------------
// Authentication and authorization utilities.
// Note that many of these are need the global header data as an argument.
// -------------------------------------------------------------------------------------------------

import CONTEXT from './CONTEXT';
import COOKIE from './COOKIE';

// -------------------------------------------------------------------------------------------------
// Authentication related functions.
// -------------------------------------------------------------------------------------------------

function IsLoggedIn(header) {
    //
    // We can either check the global header auth field or check for the cookie. 
    // Probably better more React-ish to check this global state, especially
    // since the way we detect the existence of the authtoken cookie is a bit
    // hacky since it is an HttpOnly cookie (see COOKIE.HasAuthToken).
    //
    if (CONTEXT.Client.IsLocal() && IsFauxLoggedIn()) {
        return true;
    }
    //
    // Actually need this because we do not know that we are logged
    // in on refresh unless/until the /header is fetched.
    //
    if (header?.auth?.authenticated) {
        return true;
    }
    else if (COOKIE.HasAuthToken()) {
        return true;
    }
    else {
        return false;
    }
    // return header?.auth?.authenticated || COOKIE.HasAuthToken();
}

function IsFauxLoggedIn() {
    return CONTEXT.Client.IsLocal() && COOKIE.HasFauxLogin();
}

function LoggedInUser(header) {
    if (CONTEXT.Client.IsLocal() && IsFauxLoggedIn()) {
        return "faux-login";
    }
    return header?.auth?.authenticated ? header.auth?.user : "unknown";
}

function LoggedInUserName(header) {
    if (CONTEXT.Client.IsLocal() && IsFauxLoggedIn()) {
        return "faux-login";
    }
    const first_name = header?.auth?.authenticated ? header.auth?.first_name : "";
    const last_name = header?.auth?.authenticated ? header.auth?.last_name : "";
    return first_name + " " + last_name;
}

function LoggedInUserVerified(header) {
    return header?.auth?.authenticated ? header.auth?.user_verified : false;
}

function LoggedInUserAuthToken(header) {
    return header?.auth;
}

function LoggedInUserAuthEnvs(header) {
    return COOKIE.AuthEnvs();
}

function LoggedInUserJwt(header) {
    return header?.auth?.jwt;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    IsFauxLoggedIn:            IsFauxLoggedIn,
    IsLoggedIn:                IsLoggedIn,
    LoggedInUser:              LoggedInUser,
    LoggedInUserName:          LoggedInUserName,
    LoggedInUserVerified:      LoggedInUserVerified,
    LoggedInUserJwt:           LoggedInUserJwt,
    LoggedInUserAuthToken:     LoggedInUserAuthToken,
    LoggedInUserAuthEnvs:      LoggedInUserAuthEnvs
}
