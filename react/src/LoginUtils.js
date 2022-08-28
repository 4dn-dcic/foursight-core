import { useNavigate, Navigate } from 'react-router-dom';
import { DeleteJwtTokenCookie, GetCookie, GetDecodedJwtTokenCookie } from './CookieUtils.js';
import * as URL from './URL.js';
import * as API from './API.js';
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
        const leewaySeconds = 30;
        const jwtTokenExpirationDateTime = new Date((jwtTokenExpirationTimeT + leewaySeconds) * 1000);
        const jwtTokenTimeTillExpirationMs = jwtTokenExpirationDateTime - new Date();
        if (jwtTokenTimeTillExpirationMs <= 0) {
            console.log("JWT token expired -> " + jwtTokenExpirationDateTime + " [" + jwtTokenExpirationTimeT + "]" + " [" + jwtTokenTimeTillExpirationMs + "]");
            console.log(new Date());
            return false
        }
    }
    return true;
}

export const GetLoginInfo = () => {
    return GetDecodedJwtTokenCookie();
}

export const Logout = (navigate) => {
    DeleteJwtTokenCookie();
    if (navigate) {
        //
        // Cannot create useNavigate locally here:
        // Hooks can only be called inside of the body of a function component.
        // So caller passes it in.
        //
        navigate(URL.Url("/login", true));
    }
}

export const VerifyLogin = () => {
    //
    // TODO
    // Not the way to do this I think. More investigation.
    // Get warning/errors like:
    // You should call navigate() in a React.useEffect(), not when your component is first rendered.
    // Warning: Cannot update a component (`BrowserRouter`) while rendering a different component (`Info`).
    // To locate the bad setState() call inside `Info`, follow the stack trace as described in https://reactjs.org/link/setstate-in-render
    //
    let navigate = useNavigate()
    if (!IsLoggedIn()) {
        navigate(URL.Url("/login", true));
        return false;
    }
    return true;
}

export const Auth0CallbackUrl = () => {
    const auth0CallbackCookie = GetCookie("auth0CallbackUrl");
    if (Utils.isNonEmptyString(auth0CallbackCookie)) {
        return auth0CallbackCookie;
    }
    else {
        return API.UrlAbs("/api/callback/");
    }
}

function IsUnknownEnv(env, info) {
    if (env && info?.envs?.unique_annotated) {
        env = env.toUpperCase();
        for (let i = info.envs ; i < info.envs.unique_annotated.length ; i++) {
            let knownEnv = info.envs.unique_annotated[i];
            if (knownEnv.toUpperCase() === env) {
                return false;
            }
        }
        return true;
    }
    else {
        return false;
    }
}

export const LoginRequired = ({ children }) => {
    return IsLoggedIn() ? children : <Navigate to={URL.Url("/login", true)} replace />;
}
