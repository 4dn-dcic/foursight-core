import { useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import GlobalContext from '../GlobalContext';
import * as URL from './URL';
import AUTH from './AUTH';
import CLIENT from './CLIENT';
import COOKIE from './COOKIE';
import SERVER from './SERVER';
import STR from './STR';
import UTIL from './UTIL';

export const Auth0CallbackUrl = () => {
    if (CLIENT.IsLocal()) {
        //return API.UrlAbs("/callback/");
        return SERVER.UrlAbs("/callback/");
    }
    else {
        //return API.UrlAbs("/api/callback/");
        return SERVER.UrlAbs("/api/callback/");
    }
}

    // TODO: Refactor WRT Env.js
    function isKnownEnv(env, header) {
        if (!env) return false;
        env = env.toLowerCase();
        for (let i = 0 ; i < header.envs?.unique_annotated?.length ; i++) {
            const env_annotated = header.envs?.unique_annotated[i];
            if ((env_annotated.name.toLowerCase() == env) ||
                (env_annotated.full_name.toLowerCase() == env) ||
                (env_annotated.short_name.toLowerCase() == env) ||
                (env_annotated.public_name.toLowerCase() == env) ||
                (env_annotated.foursight_name.toLowerCase() == env)) {
                return true;
            }
        }
        return false;
    }

export const ValidEnvRequired = ({ children }) => {
    // TODO: Change to look at current env in the URL this by looping through header.env.unique_annototated.
    CLIENT.NoteLastUrl();
    const [ header ] = useContext(GlobalContext);
    return !isKnownEnv(CLIENT.Env(), header) ? <Navigate to={CLIENT.Path("/env")} replace /> : children;
}

export const LoginAndValidEnvRequired = ({ children }) => {
    CLIENT.NoteLastUrl();
    const [ header ] = useContext(GlobalContext);
    if (CLIENT.Env() === "" || header.env_unknown) {
        return <Navigate to={CLIENT.Path("/env")} replace />
    }
    else if (!AUTH.IsLoggedIn(header)) {
        return <Navigate to={CLIENT.Path("/login")} replace />
    }
    else if (header.env && !IsAllowedEnv(header.env)) {
        return <Navigate to={CLIENT.Path("/env")} replace />
    }
    else {
        return children;
    }
}

export const GetAllowedEnvs = () => {
    try {
        const authEnvsCookie = COOKIE.Get("authEnvs");
        const authEnvsCookieDecoded = atob(authEnvsCookie);
        const authEnvsCookieJson = JSON.parse(authEnvsCookieDecoded);
        return authEnvsCookieJson;
    } catch {
        return null;
    }
}

export const IsAllowedEnv = (envAnnotated) => {
    const allowedEnvs = GetAllowedEnvs();
    if (!allowedEnvs) {
        return true;
    }
    for (const allowedEnv of allowedEnvs) {
        if (IsSameEnv(allowedEnv, envAnnotated)) {
            return true;
        }
    }
    return false;
}

// Returns true iff the given two environments refer to same environment.
// The arguments may be either strings and/or JSON objects from the global
// header data element containing the annotated environment names, i.e. which
// contains these elements: name, full_name, short_name, public_name, foursight_name.
//
export const IsSameEnv = (envA, envB) => {
    if (UTIL.IsObject(envA)) {
        if (UTIL.IsObject(envB)) {
            return (envA?.name?.toLowerCase()           == envB?.name?.toLowerCase()) &&
                   (envA?.full_name?.toLowerCase()      == envB?.full_name?.toLowerCase()) &&
                   (envA?.short_name?.toLowerCase()     == envB?.short_name?.toLowerCase()) &&
                   (envA?.public_name?.toLowerCase()    == envB?.public_name?.toLowerCase()) &&
                   (envA?.foursight_name?.toLowerCase() == envB?.foursight_name?.toLowerCase());
        }
        else if (STR.HasValue(envB)) {
            envB = envB.toLowerCase();
            return (envA?.name?.toLowerCase()           == envB) ||
                   (envA?.full_name?.toLowerCase()      == envB) ||
                   (envA?.short_name?.toLowerCase()     == envB) ||
                   (envA?.public_name?.toLowerCase()    == envB) ||
                   (envA?.foursight_name?.toLowerCase() == envB);
        }
        else {
            return false;
        }
    }
    else if (STR.HasValue(envA)) {
        if (UTIL.IsObject(envB)) {
            envA = envA.toLowerCase();
            return (envB?.name?.toLowerCase()           == envA) ||
                   (envB?.full_name?.toLowerCase()      == envA) ||
                   (envB?.short_name?.toLowerCase()     == envA) ||
                   (envB?.public_name?.toLowerCase()    == envA) ||
                   (envB?.foursight_name?.toLowerCase() == envA);
        }
        else if (STR.HasValue(envB)) {
            return envA.toLowerCase() == envB.toLowerCase();
        }
        else {
            return false;
        }
    }
    else {
        return false;
    }
}
