// -------------------------------------------------------------------------------------------------
// Authentication and authorization utilities.
// Note that many of these are need the global header data as an argument.
// -------------------------------------------------------------------------------------------------

import CLIENT from './CLIENT';
import COOKIE from './COOKIE';
import ENV from './ENV';
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
    return header?.auth?.authenticated;
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
    window.location.replace(SERVER.Url("/logout", CLIENT.Env()));
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
// Authorization (allowed environments) functions.
// -------------------------------------------------------------------------------------------------

function GetAllowedEnvs(header) {
    return header?.auth?.allowed_envs || [];
}

function GetKnownEnvs(header) {
    return header?.envs?.unique_annotated || [];
}

function IsAllowedEnv(env, header) {
    if ((STR.HasValue(env) || TYPE.IsObject(env)) && TYPE.IsObject(header)) {
        const allowedEnvs = GetAllowedEnvs(header);
        for (const allowedEnv of allowedEnvs) {
            if (ENV.Equals(allowedEnv, env)) {
                return true;
            }
        }
    }
    return false;
}

function IsKnownEnv(env, header) {
    if ((STR.HasValue(env) || TYPE.IsObject(env)) && TYPE.IsObject(header)) {
        const knownEnvs = GetKnownEnvs(header);
        for (const knownEnv of knownEnvs) {
            if (ENV.Equals(knownEnv, env)) {
                return true;
            }
        }
    }
    return false;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    AllowedEnvs:               GetAllowedEnvs,
    AuthenticationCallbackUrl: AuthenticationCallbackUrl,
    AuthenticationClientID:    AuthenticationClientID,
    IsAllowedEnv:              IsAllowedEnv,
    IsFauxLoggedIn:            IsFauxLoggedIn,
    IsKnownEnv:                IsKnownEnv,
    IsLoggedIn:                IsLoggedIn,
    KnownEnvs:                 GetKnownEnvs,
    LoggedInUser:              LoggedInUser,
    LoggedInUserVerified:      LoggedInUserVerified,
    LoggedInUserJwt:           LoggedInUserJwt,
    LoggedInUserAuthRecord:    LoggedInUserAuthRecord,
    Logout:                    Logout
}
