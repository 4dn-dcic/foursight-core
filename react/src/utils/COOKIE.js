import Cookies from 'universal-cookie';
import * as Utils from './Utils';

const _cookies             = new Cookies()
const _authTokenCookieName = "authtoken";
const _fauxLoginCookieName = "test_mode_login_localhost";
const _redirectCookieName  = "reactredir";
const _lastUrlCookieName   = "lasturl";
const _cookiePath           = "/";
const _cookieDomain         = document.location.hostname;

function GetCookie(name) {
    const value = _cookies.get(name);
    return (value === "") ? null : value;
}

function DeleteCookie(name) {
    if (Utils.isNonEmptyString(name)) {
        _cookies.remove(name, { path: _cookiePath });
    }
}

function SetCookie(name, value, expires = null) {
    if (Utils.isNonEmptyString(name)) {
        if (Utils.isNonEmptyString(value)) {
            _cookies.set(name, value, { path: _cookiePath, expires: expires });
        } else {
            DeleteCookie(name);
        }
    }
}

function HasAuthTokenCookie() {
    const authTokenCookie = GetCookie(_authTokenCookieName);
    if (Utils.isNonEmptyString(authTokenCookie)) {
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
        if (dummyAuthTokenCookie == "dummy") {
            DeleteCookie(_authTokenCookieName);
            return false;
        }
        return true;

    }
    catch {
        return true;
    }
}

function HasFauxLoginCookie() {
    return GetCookie(_fauxLoginCookieName) == "1";
}

function DeleteFauxLoginCookie() {
    return DeleteCookie(_fauxLoginCookieName);
}

function GetLastUrlCookie() {
    return GetCookie(_lastUrlCookieName);
}

function SetLastUrlCookie(url) {
    SetCookie(_lastUrlCookieName, url);
}

export default {
    Get: GetCookie,
    GetLastUrlCookie: GetLastUrlCookie,
    Set: SetCookie,
    SetLastUrlCookie: SetLastUrlCookie,
    Delete: DeleteCookie,
    DeleteFauxLogin: DeleteFauxLoginCookie,
    HasAuthToken: HasAuthTokenCookie,
    HasFauxLogin: HasFauxLoginCookie,
}
