import Cookies from 'universal-cookie';
import CLIENT from './CLIENT';
import STR from './STR';
import TYPE from './TYPE';

const _cookies              = new Cookies()
const _authTokenCookieName  = "authtoken";
const _authEnvsCookieName   = "authenvs";
const _fauxLoginCookieName  = "test_mode_login_localhost";
const _redirectCookieName   = "reactredir";
const _lastUrlCookieName    = "lasturl";
const _cookiePath           = "/";
const _cookieDomain         = document.location.hostname;

// -------------------------------------------------------------------------------------------------
// General cookie functions.
// -------------------------------------------------------------------------------------------------

function GetCookieDomain() {
    return CLIENT.IsLocal() ? _cookieDomain : "." + _cookieDomain;
}

function GetCookie(name) {
    if (STR.HasValue(name)) {
        const value = _cookies.get(name);
        console.log(`GET COOKIE: [${name}] -> [${value}]`);
        return (value === "") ? null : value;
    }
    return null;
}

function DeleteCookie(name) {
    if (STR.HasValue(name)) {
        console.log(`DELETE COOKIE: [${name}] = [${GetCookie(name)}] (${GetCookieDomain()})`);
         //
        // The universal-cookie library is not working for delete, at least with a cookie
        // domain which includes all sub-domains, i.e. cookie domains beginning with a dot.
        // And since the server sets cookies (e.g. the authtoken cookie) with a cookie domain
        // beginning with a dot (i.e. which includes all sub-domains), which does seem like the
        // right thing to do, we use this low-tech non-universal-cookie-library way of cookie deletion.
        // _cookies.remove(name, { path: _cookiePath });
        //
        const domain = GetCookieDomain();
        console.log("DELETE COOKIE USING OLD-SCHOOL METHOD:");
        const cookieDeletionString = `${name}=; Path=/; Domain=${domain}; Expires=Thu, 01 Jan 1970 00:00:00 UTC`;
        console.log(cookieDeletionString);
        document.cookie = cookieDeletionString;
        console.log(`VERIFY DELETE COOKIE: [${name}] -> [${GetCookie(name)}] (${domain})`);
    }
}

function SetCookie(name, value, expires = null) {
    if (STR.HasValue(name)) {
        if (STR.HasValue(value)) {
            //
            // _cookies.set(name, value, { path: _cookiePath, expires: expires });
            //
            const domain = GetCookieDomain();
            console.log(`SET COOKIE [${name}] -> [${value}] (${domain})`);
            _cookies.set(name, value, { domain: _cookieDomain, path: _cookiePath});
            console.log(`VERIFY SET COOKIE [${name}] -> [${GetCookie(name)}] (${domain})`);
        } else if (TYPE.IsNull(value)) {
            console.log(`SET COOKIE [${name}] -> NULL VALUE (DELETE IT)`);
            DeleteCookie(name);
        }
        else {
            console.log(`SET COOKIE [${name}] -> NO VALUE (DO NOTHING)`);
        }
    }
}

// -------------------------------------------------------------------------------------------------
// Authentication related cookie functions.
// -------------------------------------------------------------------------------------------------

function HasAuthTokenCookie() {
    console.log("CHECK FOR AUTHTOKEN");
    const authTokenCookie = GetCookie(_authTokenCookieName);
    if (STR.HasValue(authTokenCookie)) {
        console.log("HAVE AUTHTOKEN (UNEXPECTEDLY READABLE AS SHOULD BE HTTPONLY)");
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
        console.log("TEST SET AUTHTOKEN TO DETECT EXISTENCE");
        SetCookie(_authTokenCookieName, "dummy");
        const dummyAuthTokenCookie = GetCookie(_authTokenCookieName);
        if (dummyAuthTokenCookie == "dummy") {
            console.log("SET AUTHTOKEN OK MEANING IT DOES NOT EXIST (NOW DELETE IT)");
            DeleteCookie(_authTokenCookieName);
            console.log("RETURN FALSE FROM CHECK FOR AUTHTOKEN");
            return false;
        }
        console.log("TEST SET AUTHTOKEN NOT OK MEANING IT DOES EXIST");
        console.log("RETURN TRUE FROM CHECK FOR AUTHTOKEN");
        return true;
    }
    catch {
        console.log("TEST SET AUTHTOKEN EXCEPTION MEANING IT DOES EXIST");
        console.log("RETURN TRUE FROM CHECK FOR AUTHTOKEN");
        return true;
    }
}

// -------------------------------------------------------------------------------------------------
// Authorized environments (known, default, allowed) cookie (authenvs) related functions.
// -------------------------------------------------------------------------------------------------

function GetAuthEnvsCookie() {
    try {
        console.log("GET AUTHENVS COOKIE");
        const authEnvsEncoded = GetCookie(_authEnvsCookieName);
        const authEnvsDecoded = atob(authEnvsEncoded);
        const authEnvs = JSON.parse(authEnvsDecoded);
        console.log("GET AUTHENVS COOKIE");
        console.log(authEnvs);
        return authEnvs;
    }
    catch {
        console.log("GET AUTHENVS COOKIE EXCEPTION");
        return [];
    }
}

function GetKnownEnvsCookie() {
    try {
        console.log("GET KNOWN ENVS COOKIE");
        const knownEnvs = GetAuthEnvsCookie()?.known_envs || [];
        console.log("GOT KNOWN ENVS COOKIE");
        console.log(knownEnvs);
        return knownEnvs;
    }
    catch {
        console.log("GET KNOWN ENVS COOKIE EXCEPTION");
        return [];
    }
}

function GetDefaultEnvCookie() {
    try {
        console.log("GET DEFAULT ENV COOKIE");
        const defaultEnv = GetAuthEnvsCookie()?.default_env || "";
        console.log("GOT DEFAULT ENV COOKIE");
        console.log(defaultEnv);
        return defaultEnv;
    }
    catch {
        console.log("GET KNOWN ENVS COOKIE EXCEPTION");
        return [];
    }
}


function GetAllowedEnvsCookie() {
    try {
        console.log("GET ALLOWED ENVS COOKIE");
        const allowedEnvs = GetAuthEnvsCookie()?.allowed_envs || [];
        console.log("GOT ALLOWED ENVS COOKIE");
        console.log(allowedEnvs);
        return allowedEnvs;
    }
    catch {
        console.log("GET ALLOWED ENVS COOKIE EXCEPTION");
        return [];
    }
}

// -------------------------------------------------------------------------------------------------
// Faux login related cookies.
// -------------------------------------------------------------------------------------------------

function HasFauxLoginCookie() {
    return GetCookie(_fauxLoginCookieName) == "1";
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
    return GetCookie("test_mode_foursight_cgap") === "1";
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    AllowedEnvs:     GetAllowedEnvsCookie,
    Delete:          DeleteCookie,
    DeleteFauxLogin: DeleteFauxLoginCookie,
    Get:             GetCookie,
    DefaultEnv:      GetDefaultEnvCookie,
    KnownEnvs:       GetKnownEnvsCookie,
    GetLastUrl:      GetLastUrlCookie,
    HasAuthToken:    HasAuthTokenCookie,
    HasFauxLogin:    HasFauxLoginCookie,
    Set:             SetCookie,
    SetFauxLogin:    SetFauxLoginCookie,
    SetLastUrl:      SetLastUrlCookie,
    SetRedirect:     SetRedirectCookie,

    TestMode: {
        HasFetchSleep:         HasTestModeFetchSleepCookie,
        FetchSleep:            GetTestModeFetchSleepCookie,
        HasFoursightFourfront: HasTestModeFoursightFourfrontCookie,
        HasFoursightCgap:      HasTestModeFoursightCgapCookie
    }
}
