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
const _EPOCH_DATE_STRING      = "Thu, 01 Jan 1970 00:00:00 UTC";

// -------------------------------------------------------------------------------------------------
// General cookie functions.
// -------------------------------------------------------------------------------------------------

function GetCookieDomain() {
    return Context.Client.IsLocal() ? _cookieDomain : "." + _cookieDomain;
}

// Gets (reads) the value of the cookie of the given name.
//
function GetCookie(name) {
    if (Str.HasValue(name)) {
        const value = _cookies.get(name);
        return (value === "") ? null : value;
    }
    return null;
}

// Deletes the cookie of the given name.
//
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
        const cookieDeletionString = `${name}=; Path=${_cookiePath}; Domain=${domain}; Expires=${_EPOCH_DATE_STRING}`;
        document.cookie = cookieDeletionString;
    }
}

// Sets (writes) the cookie of the given name with the given value.
// The optional expires argument should be a Date object specifying
// the absolute (local) time at which the cookie should expires;
// if not set then no expiration time (i.e. session cookie).
//
function SetCookie(name, value, expires = null) {
    if (Str.HasValue(name)) {
        if (Str.HasValue(value)) {
            if (Type.IsInteger(expires)) {
                //
                // If expires is an integer then assume it is seconds since the epoch.
                //
                expires = new Date(expires * 1000);
            }
            if (!Type.IsDateTime(expires)) {
                expires = null;
            }
            _cookies.set(name, value, { domain: GetCookieDomain(), path: _cookiePath, expires: expires});
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
    } catch {}
    return {};
}

function GetAuthTokenRawCookie() {
    return GetCookie(_authTokenCookieName);
}

function GetKnownEnvsCookie() {
    return GetAuthTokenCookie()?.known_envs || [];
}

function GetDefaultEnvCookie() {
    return GetAuthTokenCookie()?.default_env || "";
}


function GetAllowedEnvsCookie() {
    return GetAuthTokenCookie()?.allowed_envs || [];
}

function GetSiteCookie() {
    return GetAuthTokenCookie()?.site || ""
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

function GetRedirectCookie() {
    return GetCookie(_redirectCookieName);
}

// -------------------------------------------------------------------------------------------------
// Readonly mode related cookies.
// Boolean value indicating whether or not we are (globally) in "read-only" mode, meaning that
// possibly destructive (i.e. not read-only, i.e. possibly read-write) operations are disabled.
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

function GetTestModeFetchSleepCookie() {
    return parseInt(GetCookie("test_mode_fetch_sleep"));
}

function HasTestModeFoursightFlavorCookie(flavor) {
    return GetCookie("test_mode_foursight_flavor") === flavor;
}

function HasTestModeFoursightFourfrontCookie() {
    return HasTestModeFoursightFlavorCookie("fourfront");
}

function HasTestModeFoursightCgapCookie() {
    return HasTestModeFoursightFlavorCookie("cgap");
}

function HasTestModeFoursightSmahtCookie() {
    return HasTestModeFoursightFlavorCookie("smaht");
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
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
    Redirect:        GetRedirectCookie,
    Site:            GetSiteCookie,
    Set:             SetCookie,
    SetLastUrl:      SetLastUrlCookie,
    SetReadOnlyMode: SetReadOnlyMode,
    SetRedirect:     SetRedirectCookie,

    TestMode: {
        FetchSleep:            GetTestModeFetchSleepCookie,
        HasFoursightCgap:      HasTestModeFoursightCgapCookie,
        HasFoursightFlavor:     HasTestModeFoursightFlavorCookie,
        HasFoursightFourfront: HasTestModeFoursightFourfrontCookie,
        HasFoursightSmaht:     HasTestModeFoursightSmahtCookie
    }
}; export default exports;
