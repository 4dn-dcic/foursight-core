import { useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import GlobalContext from './GlobalContext';
import { DeleteAuthTokenCookie, DeleteJwtTokenCookie, GetAuthTokenCookie, GetCookie, GetDecodedJwtTokenCookie } from './CookieUtils';
import * as URL from './URL';
import * as API from './API';
import * as Utils from './Utils';

// Do some caching maybe of logged in state ... maybe not ...
// depending on how expensive really it is to read cookie and decode JWT.

export const IsRunningLocally = () => {
    return window.location.hostname == "localhost";
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

    if (IsRunningLocally()) {
        return true;
    }
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
            return false;
        }
    }
    const authToken = GetAuthTokenCookie();
    if (!Utils.isNonEmptyString(authToken)) {
        return false;
    }
    return true;
}

export const GetLoginInfo = () => {
    if (IsRunningLocally()) {
        return { "email": "localhost" }
    }
    return GetDecodedJwtTokenCookie();
}

export const Logout = (navigate) => {
    DeleteJwtTokenCookie();
    DeleteAuthTokenCookie();
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

export const ValidEnvRequired = ({ children }) => {
    const [ info ] = useContext(GlobalContext);
    return URL.Env() === "" || info.env_unknown ? <Navigate to={URL.Url("/envs")} replace /> : children;
    //return URL.Env() == "" || info.env_unknown ? <Navigate to={URL.Url("/envs", true)} replace /> : <Navigate to={URL.Url("/info", true)} replace />
}

export const LoginRequired = ({ children }) => {
    const [ info ] = useContext(GlobalContext);
    //return !info.error && !info.env_unknown && IsLoggedIn() ? children : <Navigate to={URL.Url("/login", true)} replace />;
    return !IsLoggedIn() ? <Navigate to={URL.Url("/login", true)} replace /> : children;
}

export const LoginAndValidEnvRequired = ({ children }) => {
    const [ info ] = useContext(GlobalContext);
    if (URL.Env() === "" || info.env_unknown) {
        return <Navigate to={URL.Url("/envs", true)} replace />
    }
    else if (!IsLoggedIn()) {
        return <Navigate to={URL.Url("/login", true)} replace />
    }
    else {
        return children;
    }
}
