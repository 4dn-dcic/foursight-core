// -------------------------------------------------------------------------------------------------
// Authentication and authorization utilities.
// Note that many of these are need the global header data as an argument.
// -------------------------------------------------------------------------------------------------

import CLIENT from './CLIENT';
import COOKIE from './COOKIE';
import SERVER from './SERVER';
import STR from './STR';
import TYPE from './TYPE';

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
    if (CLIENT.IsLocal() && IsFauxLoggedIn()) {
        return true;
    }
    //
    // Actually need this because we do not know that we are logged
    // in on refresh unless/until the /header is fetched.
    //
    console.log("CHECK IS LOGGED IN");
    if (header?.auth?.authenticated) {
        console.log("IS LOGGED IN BY WAY OF HEADER DATA");
        return true;
    }
    else if (COOKIE.HasAuthToken()) {
        console.log("IS LOGGED IN BY WAY OF COOKIE");
        return true;
    }
    else {
        console.log("IS NOT LOGGED IN");
        return false;
    }
    // return header?.auth?.authenticated || COOKIE.HasAuthToken();
}

function IsFauxLoggedIn() {
    return CLIENT.IsLocal() && COOKIE.HasFauxLogin();
}

function LoggedInUser(header) {
    if (CLIENT.IsLocal() && IsFauxLoggedIn()) {
        return "faux-login";
    }
    return header?.auth?.authenticated ? header.auth?.user : "unknown";
}

function LoggedInUserVerified(header) {
    return header?.auth?.authenticated ? header.auth?.user_verified : false;
}

function LoggedInUserAuthRecord(header) {
    return header?.auth;
}

function LoggedInUserJwt(header) {
    return header?.auth?.jwt;
}

// Redirects to the server /logout page in order to delete the authtoken cookie.
// The server should redirect back to the value of CLIENT.LastPath (from the lasturl cookie)
//
function Logout() {
    COOKIE.DeleteFauxLogin();
    window.location.replace(SERVER.Url("/logout", CLIENT.Current.Env()));
}

// This is the server (React API) URL for Auth0 to callback to.
//
function AuthenticationCallbackUrl() {
    if (CLIENT.IsLocal()) {
        return SERVER.UrlAbs("/callback/");
    }
    else {
        return SERVER.UrlAbs("/api/callback/");
    }
}

function AuthenticationClientID(header) {
    return header?.app?.credentials?.auth0_client_id;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    AuthenticationCallbackUrl: AuthenticationCallbackUrl,
    AuthenticationClientID:    AuthenticationClientID,
    IsFauxLoggedIn:            IsFauxLoggedIn,
    IsLoggedIn:                IsLoggedIn,
    LoggedInUser:              LoggedInUser,
    LoggedInUserVerified:      LoggedInUserVerified,
    LoggedInUserJwt:           LoggedInUserJwt,
    LoggedInUserAuthRecord:    LoggedInUserAuthRecord,
    Logout:                    Logout
}
