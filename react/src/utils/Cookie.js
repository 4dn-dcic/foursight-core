// -------------------------------------------------------------------------------------------------
// Cookie related functions.
// -------------------------------------------------------------------------------------------------

import Cookies from 'universal-cookie';
import Context from './Context';
import Jwt from './Jwt';
import Str from './Str';
import Type from './Type';

const _cookies                = new Cookies()
const _authTokenCookieName    = "authtoken";
const _authCookieName         = "auth";
const _redirectCookieName     = "reactredir";
const _lastUrlCookieName      = "lasturl";
const _readOnlyModeCookieName = "readonly";
const _cookiePath             = "/";
const _cookieDomain           = document.location.hostname;

// -------------------------------------------------------------------------------------------------
// General cookie functions.
// -------------------------------------------------------------------------------------------------

function GetCookieDomain() {
    return Context.Client.IsLocal() ? _cookieDomain : "." + _cookieDomain;
}

function GetCookie(name) {
    if (Str.HasValue(name)) {
        const value = _cookies.get(name);
        return (value === "") ? null : value;
    }
    return null;
}

function DeleteCookie(name) {
    if (Str.HasValue(name)) {
         //
        // The universal-cookie library is not working for delete, at least with a cookie
        // domain which includes all sub-domains, i.e. cookie domains beginning with a dot.
        // And since the server sets cookies (e.g. the authtoken cookie) with a cookie domain
        // beginning with a dot (i.e. which includes all sub-domains), which does seem like the
        // right thing to do, we use this low-tech non-universal-cookie-library way of cookie deletion.
        // _cookies.remove(name, { path: _cookiePath });
        //
        const domain = GetCookieDomain();
        const cookieDeletionString = `${name}=; Path=${_cookiePath}; Domain=${domain}; Expires=Thu, 01 Jan 1970 00:00:00 UTC`;
        document.cookie = cookieDeletionString;
    }
}

function SetCookie(name, value, expires = null) {
    if (Str.HasValue(name)) {
        if (Str.HasValue(value)) {
            //
            // _cookies.set(name, value, { path: _cookiePath, expires: expires });
            //
            const domain = GetCookieDomain();
            _cookies.set(name, value, { domain: domain, path: _cookiePath});
        } else if (Type.IsNull(value)) {
            DeleteCookie(name);
        }
        else {
        }
    }
}

// -------------------------------------------------------------------------------------------------
// Authentication related cookie functions.
// -------------------------------------------------------------------------------------------------

function HasAuthTokenCookie() {

    // With new scheme of having the authtoken cookie be our JWT-encoded (signed, actually)
    // authorization object, which is NOT an HttpOnly, cookie we don't need any of the below.
    //
    return Str.HasValue(GetCookie(_authTokenCookieName));
}

// -------------------------------------------------------------------------------------------------
// Authorized environments (known, default, allowed) cookie (authenvs) related functions.
// -------------------------------------------------------------------------------------------------

// Returns the DECODED (but not signature-verified) authtoken cookie.
//
function GetAuthTokenCookie() {
    try {
        const authTokenCookie = GetCookie(_authTokenCookieName);
        if (Str.HasValue(authTokenCookie)) {
            const authToken = Jwt.Decode(authTokenCookie);
            if (Type.IsObject(authToken)) {
                return authToken || {};
            }
        }
    }
    catch { }
    return [];
}

function GetAuthTokenRawCookie() {
    return GetCookie(_authTokenCookieName);
}

function GetKnownEnvsCookie() {
    try {
        const knownEnvs = GetAuthTokenCookie()?.known_envs || [];
        return knownEnvs;
    }
    catch {
        return [];
    }
}

function GetDefaultEnvCookie() {
    try {
        const defaultEnv = GetAuthTokenCookie()?.default_env || "";
        return defaultEnv;
    }
    catch {
        return [];
    }
}


function GetAllowedEnvsCookie() {
    try {
        const allowedEnvs = GetAuthTokenCookie()?.allowed_envs || [];
        return allowedEnvs;
    }
    catch {
        return [];
    }
}

function DeleteAuthCookie() {
    DeleteCookie(_authCookieName);
}

// -------------------------------------------------------------------------------------------------
// Last URL related cookies.
// -------------------------------------------------------------------------------------------------

function GetLastUrlCookie() {
    return GetCookie(_lastUrlCookieName);
}

function SetLastUrlCookie(url) {
    SetCookie(_lastUrlCookieName, url);
}

// -------------------------------------------------------------------------------------------------
// Redirect URL related cookies.
// -------------------------------------------------------------------------------------------------

function SetRedirectCookie(url, expires = null) {
    SetCookie(_redirectCookieName, url, expires);
}

// -------------------------------------------------------------------------------------------------
// Readonly mode related cookies.
// -------------------------------------------------------------------------------------------------

function IsReadOnlyMode() {
    return GetCookie(_readOnlyModeCookieName) === "1";
}

function SetReadOnlyMode(value) {
    SetCookie(_readOnlyModeCookieName, value ? "1" : "0");
}

// -------------------------------------------------------------------------------------------------
// Test mode related cookies.
// -------------------------------------------------------------------------------------------------

function HasTestModeFetchSleepCookie() {
    return GetCookie("test_mode_fetch_sleep") > 0;
}

function GetTestModeFetchSleepCookie() {
    return parseInt(GetCookie("test_mode_fetch_sleep"));
}

function HasTestModeFoursightFourfrontCookie() {
    return GetCookie("test_mode_foursight_fourfront") === "1";
}

function HasTestModeFoursightCgapCookie() {
    return GetCookie("test_mode_foursight_fourfront") === "0";
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    AllowedEnvs:     GetAllowedEnvsCookie,
    AuthToken:       GetAuthTokenCookie,
    AuthTokenRaw:    GetAuthTokenRawCookie,
    Delete:          DeleteCookie,
    DeleteAuth:      DeleteAuthCookie,
    Get:             GetCookie,
    DefaultEnv:      GetDefaultEnvCookie,
    KnownEnvs:       GetKnownEnvsCookie,
    LastUrl:         GetLastUrlCookie,
    HasAuthToken:    HasAuthTokenCookie,
    IsReadOnlyMode:  IsReadOnlyMode,
    Set:             SetCookie,
    SetLastUrl:      SetLastUrlCookie,
    SetReadOnlyMode: SetReadOnlyMode,
    SetRedirect:     SetRedirectCookie,

    TestMode: {
        HasFetchSleep:         HasTestModeFetchSleepCookie,
        FetchSleep:            GetTestModeFetchSleepCookie,
        HasFoursightFourfront: HasTestModeFoursightFourfrontCookie,
        HasFoursightCgap:      HasTestModeFoursightCgapCookie
    }
};
export default Exports;
