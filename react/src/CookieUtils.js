import Cookies from 'universal-cookie';
import { decodeToken as DecodeJwtToken } from "react-jwt";
import * as Utils from './Utils.js';

let _cookies = new Cookies()
const _JWT_TOKEN_COOKIE_NAME = "jwtToken";

export const GetJwtTokenCookie = (name) => {
    return GetCookie(_JWT_TOKEN_COOKIE_NAME)
}

export const GetDecodedJwtTokenCookie = (name) => {
    const jwtToken = GetCookie(_JWT_TOKEN_COOKIE_NAME)
    if (Utils.isNonEmptyString(jwtToken)) {
        try {
            return DecodeJwtToken(jwtToken);
        } catch {
            console.log("Error parsing JWT token (" + _JWT_TOKEN_COOKIE_NAME + ").");
        }
    } else {
        console.log("No JWT token found (" + _JWT_TOKEN_COOKIE_NAME + ").")
        return undefined;
    }
}

export const IsLoggedIn = () => {
    //
    // N.B. We do not validate the JWT cookie because (1) could not get anything to work,
    // not that straight-forward for some reason; and (2) don't *think* it's that important
    // as we do check for expiration time, and when the user logs in we do it via Auth0 and
    // the server-side (our Foursight/Chalice/Python code) sets the JWT token; we a just using
    // it as a general is-logged-in flag. Probably some security issues here I'm not taking
    // into account but good for now, at least for development. Marking this as TODO.
    //
    const jwtToken = GetJwtTokenCookie();
    if (!Utils.isNonEmptyString(jwtToken)) {
        return false;
    }
    const decodedJwtToken = DecodeJwtToken(jwtToken);
    if (!Utils.isObject(decodedJwtToken)) {
            console.log('xyz2');
        return false;
    }
    //
    // N.B. The react-jwt isExpired function does not seem to work right.
    //
    const jwtTokenExpirationTimeT = decodedJwtToken.exp;
    if (jwtTokenExpirationTimeT) {
        const jwtTokenExpirationDateTime = new Date(jwtTokenExpirationTimeT * 1000);
        const jwtTokenTimeTillExpirationMs = jwtTokenExpirationDateTime - new Date();
        if (jwtTokenTimeTillExpirationMs <= 0) {
            return false;
        }
    }
    return true;
}

export const GetCookie = (name) => {
    const value = _cookies.get(name);
    return (value == "") ? undefined : value;
}

export const SetCookie = (name, value) => {
    if (Utils.isNonEmptyString(name)) {
        if (Utils.isNonEmptyString(value)) {
            _cookies.set(name, value, { path: "/"});
        } else {
            DeleteCookie(name);
        }
    }
}

export const DeleteCookie = (name) => {
    _cookies.remove(name, { path: "/" });
}
