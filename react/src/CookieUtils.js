import Cookies from 'universal-cookie';
import { decodeToken } from "react-jwt";
import * as Utils from './Utils';

const _cookies = new Cookies()
const _jwtTokenCookieName = "jwtToken";
const _authTokenCookieName = "authtoken";

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
                console.log("SET COOKIE: [" + name + "] = [" + value + "] EXPIRES = [" + expires + "]")
            //document.cookie = "redir=" + window.location.href + "; path=/; expires=" + expires.toUTCString();
                document.cookie = name + "=" + value + "; expires=" + expires + ";" + "path=/; domain=" + document.location.hostname + ";";
            }
            else {
                console.log("SET COOKIE: [" + name + "] = [" + value + "]")
                document.cookie = name + "=" + value + "; path=/; domain=" + document.location.hostname + ";";
            }
        } else {
            DeleteCookie(name);
        }
    }
}

export const DeleteCookie = (name) => {
    _cookies.remove(name, { path: "/" });
    // Issues with leading dot on domain name in cookie ...
    document.cookie = "jwtToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + document.location.hostname + ";";
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
    DeleteCookie(_jwtTokenCookieName)
}

export const GetAuthTokenCookie = (name) => {
    return GetCookie(_authTokenCookieName);
}

export const DeleteAuthTokenCookie = (name) => {
    return DeleteCookie(_authTokenCookieName);
}
