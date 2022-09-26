// -------------------------------------------------------------------------------------------------
// Cookie related functions.
// -------------------------------------------------------------------------------------------------

import Cookies from 'universal-cookie';
import CONTEXT from './CONTEXT';
import STR from './STR';
import TYPE from './TYPE';

const _cookies                = new Cookies()
const _authTokenCookieName    = "authtoken";
const _authEnvsCookieName     = "authenvs";
const _fauxLoginCookieName    = "test_mode_login_localhost";
const _redirectCookieName     = "reactredir";
const _lastUrlCookieName      = "lasturl";
const _readOnlyModeCookieName = "readonly";
const _cookiePath             = "/";
const _cookieDomain           = document.location.hostname;

// -------------------------------------------------------------------------------------------------
// General cookie functions.
// -------------------------------------------------------------------------------------------------

function GetCookieDomain() {
    return CONTEXT.Client.IsLocal() ? _cookieDomain : "." + _cookieDomain;
}

function GetCookie(name) {
    if (STR.HasValue(name)) {
        const value = _cookies.get(name);
        return (value === "") ? null : value;
    }
    return null;
}

function DeleteCookie(name) {
    if (STR.HasValue(name)) {
         //
        // The universal-cookie library is not working for delete, at least with a cookie
        // domain which includes all sub-domains, i.e. cookie domains beginning with a dot.
        // And since the server sets cookies (e.g. the authtoken cookie) with a cookie domain
        // beginning with a dot (i.e. which includes all sub-domains), which does seem like the
        // right thing to do, we use this low-tech non-universal-cookie-library way of cookie deletion.
        // _cookies.remove(name, { path: _cookiePath });
        //
        const domain = GetCookieDomain();
        const cookieDeletionString = `${name}=; Path=/; Domain=${domain}; Expires=Thu, 01 Jan 1970 00:00:00 UTC`;
        document.cookie = cookieDeletionString;
    }
}

function SetCookie(name, value, expires = null) {
    if (STR.HasValue(name)) {
        if (STR.HasValue(value)) {
            //
            // _cookies.set(name, value, { path: _cookiePath, expires: expires });
            //
            const domain = GetCookieDomain();
            _cookies.set(name, value, { domain: _cookieDomain, path: _cookiePath});
        } else if (TYPE.IsNull(value)) {
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
    const authTokenCookie = GetCookie(_authTokenCookieName);
    if (STR.HasValue(authTokenCookie)) {
        //
        // The authtoken cookie exists AND we can actually read it
        // which means it is NOT an HttpOnly cookie, but whatever,
        // that is a server (React API) decision.
        //
        return true;
    }
    //
    // Here, either the authtoken cookie does not exist or it exists but we cannot
    // read it because it is an HttpOnly cookie. To see which of these situations
    // we have, try actually writing a dummy value to this cookie, and if it fails
    // (i.e. we don't read back the same dummy value), then it means this cookie
    // DOES exist as an HttpOnly cookie (so return true); if it succeeds (i.e. we
    // do read back the same dummy value), then it means this cookie did NOT exist
    // at all (so return false, after deleting the dummy cookie we wrote to cleanup).
    //
    try {
        SetCookie(_authTokenCookieName, "dummy");
        const dummyAuthTokenCookie = GetCookie(_authTokenCookieName);
        if (dummyAuthTokenCookie === "dummy") {
            DeleteCookie(_authTokenCookieName);
            return false;
        }
        return true;
    }
    catch {
        return true;
    }
}

// -------------------------------------------------------------------------------------------------
// Authorized environments (known, default, allowed) cookie (authenvs) related functions.
// -------------------------------------------------------------------------------------------------

function GetAuthEnvsCookie() {
    try {
        const authEnvsEncoded = GetCookie(_authEnvsCookieName);
        const authEnvsDecoded = atob(authEnvsEncoded);
        const authEnvs = JSON.parse(authEnvsDecoded);
        return authEnvs;
    }
    catch {
        return [];
    }
}

function GetKnownEnvsCookie() {
    try {
        const knownEnvs = GetAuthEnvsCookie()?.known_envs || [];
        return knownEnvs;
    }
    catch {
        return [];
    }
}

function GetDefaultEnvCookie() {
    try {
        const defaultEnv = GetAuthEnvsCookie()?.default_env || "";
        return defaultEnv;
    }
    catch {
        return [];
    }
}


function GetAllowedEnvsCookie() {
    try {
        const allowedEnvs = GetAuthEnvsCookie()?.allowed_envs || [];
        return allowedEnvs;
    }
    catch {
        return [];
    }
}

// -------------------------------------------------------------------------------------------------
// Faux login related cookies.
// -------------------------------------------------------------------------------------------------

function HasFauxLoginCookie() {
    return GetCookie(_fauxLoginCookieName) === "1";
}

function SetFauxLoginCookie() {
    return SetCookie(_fauxLoginCookieName, "1");
}

function DeleteFauxLoginCookie() {
    return DeleteCookie(_fauxLoginCookieName);
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
    return GetCookie("test_mode_fetch_sleep");
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

export default {
    AllowedEnvs:     GetAllowedEnvsCookie,
    AuthEnvs:        GetAuthEnvsCookie,
    Delete:          DeleteCookie,
    DeleteFauxLogin: DeleteFauxLoginCookie,
    Get:             GetCookie,
    DefaultEnv:      GetDefaultEnvCookie,
    KnownEnvs:       GetKnownEnvsCookie,
    GetLastUrl:      GetLastUrlCookie,
    HasAuthToken:    HasAuthTokenCookie,
    HasFauxLogin:    HasFauxLoginCookie,
    IsReadOnlyMode:  IsReadOnlyMode,
    Set:             SetCookie,
    SetFauxLogin:    SetFauxLoginCookie,
    SetLastUrl:      SetLastUrlCookie,
    SetReadOnlyMode: SetReadOnlyMode,
    SetRedirect:     SetRedirectCookie,

    TestMode: {
        HasFetchSleep:         HasTestModeFetchSleepCookie,
        FetchSleep:            GetTestModeFetchSleepCookie,
        HasFoursightFourfront: HasTestModeFoursightFourfrontCookie,
        HasFoursightCgap:      HasTestModeFoursightCgapCookie
    }
}
