import Cookies from 'universal-cookie';
import { decodeToken } from "react-jwt";
import * as Utils from './Utils';

const _cookies = new Cookies()
const _jwtTokenCookieName = "jwtToken";
const _authTokenCookieName = "authtoken";
const _redirectCookieName = "reactredir";
const _fauxLoginCookieName = "test_mode_login_localhost";

export const GetCookie = (name) => {
    const value = _cookies.get(name);
    return (value === "") ? undefined : value;
}

export const SetCookie = (name, value, expires = undefined) => {
    if (Utils.isNonEmptyString(name)) {
        if (Utils.isNonEmptyString(value)) {
            // Issues with setting cookie with URL value - it (universial-cookie) URL-encodes it for some reason)
            // _cookies.set(name, value, { path: "/"});
            if (expires) {
                console.log("SET COOKIE: [" + name + "] = [" + value + "] EXPIRES = [" + expires + "]");
            //document.cookie = "redir=" + window.location.href + "; path=/; expires=" + expires.toUTCString();
                document.cookie = name + "=" + value + "; expires=" + expires + ";" + "path=/; domain=" + document.location.hostname + ";";
            }
            else {
                console.log("SET COOKIE: [" + name + "] = [" + value + "]");
                document.cookie = name + "=" + value + "; path=/; domain=" + document.location.hostname + ";";
            }
        } else {
            DeleteCookie(name);
        }
    }
}

export const DeleteCookie = (name) => {
    if (Utils.isNonEmptyString(name)) {
        console.log("DELETE COOKIE: [" + name + "]");
        _cookies.remove(name, { path: "/" });
        // Issue with leading dot on domain name in cookie ...
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + document.location.hostname + ";";
    }
}

export const GetJwtTokenCookie = (name) => {
    return GetCookie(_jwtTokenCookieName);
}

export const DecodeJwtToken = (jwtToken) => {
    return decodeToken(jwtToken);
}

export const GetDecodedJwtTokenCookie = (name) => {
    const jwtToken = GetJwtTokenCookie()
    if (Utils.isNonEmptyString(jwtToken)) {
        try {
            return DecodeJwtToken(jwtToken);
        } catch {
            console.log("Error parsing JWT token.");
        }
    } else {
        console.log("No JWT token found.");
        return undefined;
    }
}

export const DeleteJwtTokenCookie = (name) => {
    DeleteCookie(_jwtTokenCookieName);
}

export const GetAuthTokenCookie = (name) => {
    return GetCookie(_authTokenCookieName);
}

export const DeleteAuthTokenCookie = (name) => {
    DeleteCookie(_authTokenCookieName);
}

export const AuthTokenCookieExists = () => {
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

export const SetRedirectCookie = (url, expires = null) => {
    SetCookie(_redirectCookieName, url, expires);
}

export const GetRedirectCookie = () => {
    return GetCookie(_redirectCookieName);
}

export const DeleteRedirectCookie = () => {
    DeleteCookie(_redirectCookieName);
}

export const SetFauxLoginCookie = () => {
    SetCookie(_fauxLoginCookieName, "1");
}

export const GetFauxLoginCookie = () => {
    return GetCookie(_fauxLoginCookieName);
}

export const DeleteFauxLoginCookie = () => {
    DeleteCookie(_fauxLoginCookieName);
}
