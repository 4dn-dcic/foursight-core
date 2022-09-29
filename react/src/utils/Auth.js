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
    // We can either check the global header auth field or check for the cookie. 
    // Probably better more React-ish to check this global state, especially
    // since the way we detect the existence of the authtoken cookie is a bit
    // hacky since it is an HttpOnly cookie (see Cookie.HasAuthToken).
    //
    if (Context.Client.IsLocal() && IsFauxLoggedIn()) {
        return true;
    }
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

function IsFauxLoggedIn() {
    return Context.Client.IsLocal() && Cookie.HasFauxLogin();
}

function LoggedInUser(header) {
    if (Context.Client.IsLocal() && IsFauxLoggedIn()) {
        return "faux-login";
    }
    return header?.auth?.authorized ? header.auth?.user : "unknown";
}

function LoggedInUserName(header) {
    if (Context.Client.IsLocal() && IsFauxLoggedIn()) {
        return "faux-login";
    }
    const first_name = header?.auth?.authorized ? header.auth?.first_name : "";
    const last_name = header?.auth?.authorized ? header.auth?.last_name : "";
    return first_name + " " + last_name;
}

function LoggedInUserVerified(header) {
    return header?.auth?.authorized ? header.auth?.user_verified : false;
}

function LoggedInUserAuthToken(header) {
    return header?.auth;
}

function LoggedInUserAuthEnvs(header) {
    return Cookie.AuthEnvs();
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
    Token:                     Cookie.AuthToken,
    LoggedInUser:              LoggedInUser,
    LoggedInUserName:          LoggedInUserName,
    LoggedInUserVerified:      LoggedInUserVerified,
    LoggedInUserJwt:           LoggedInUserJwt,
    LoggedInUserAuthToken:     LoggedInUserAuthToken,
    LoggedInUserAuthEnvs:      LoggedInUserAuthEnvs
}
