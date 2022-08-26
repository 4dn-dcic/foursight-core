import { DeleteJwtTokenCookie, GetJwtTokenCookie, GetDecodedJwtTokenCookie } from './CookieUtils.js';
import { useNavigate } from 'react-router-dom';
import { URL } from './UrlUtils.js';
import * as Utils from './Utils.js';

export const IsLoggedIn = () => {
    //
    // N.B. We do not validate the JWT cookie because (1) could not get anything to work,
    // not that straight-forward for some reason; and (2) don't *think* it's that important
    // as we do check for expiration time, and when the user logs in we do it via Auth0 and
    // the server-side (our Foursight/Chalice/Python code) sets the JWT token; we a just using
    // it as a general is-logged-in flag. Probably some security issues here I'm not taking
    // into account but good for now, at least for development. Marking this as TODO.
    //
    const decodedJwtToken = GetDecodedJwtTokenCookie();
    if (!Utils.isObject(decodedJwtToken)) {
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

export const GetLoginInfo = () => {
    return GetDecodedJwtTokenCookie();
}

export const Logout = () => {
    DeleteJwtTokenCookie();
}

export const VerifyLogin = () => {
    let navigate = useNavigate();
    if (!IsLoggedIn()) {
        navigate(URL("/login"))
    }
}
