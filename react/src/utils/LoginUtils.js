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

// Return true if the two given environments are the same.
// Handles either of them being strings or annotated environment names as returned
// by the /header endpoint, and, for now, both varieties for the annotated structure.
// TODO: Unify names annotated env names in header.env and header.envs.unique_annotated.
//
export const IsSameEnv = (envA, envB) => {
    function regular_env_name(envAnnotated) {
        return envAnnotated?.name;
    }
    function full_env_name(envAnnotated) {
        return envAnnotated?.full_name ? envAnnotated.full_name : envAnnotated?.full_name;
    }
    function short_env_name(envAnnotated) {
        return envAnnotated?.short_name ? envAnnotated.short_name : envAnnotated?.short_name;
    }
    function public_env_name(envAnnotated) {
        return envAnnotated?.public_name ? envAnnotated.public_name : envAnnotated?.public_name;
    }
    function foursight_env_name(envAnnotated) {
        return envAnnotated?.foursight_name ? envAnnotated.foursight_name : envAnnotated?.foursight_name;
    }
    if (UTIL.IsObject(envA)) {
        if (UTIL.IsObject(envB)) {
            return (regular_env_name  (envA)?.toLowerCase() == regular_env_name  (envB)?.toLowerCase()) &&
                   (full_env_name     (envA)?.toLowerCase() == full_env_name     (envB)?.toLowerCase()) &&
                   (short_env_name    (envA)?.toLowerCase() == short_env_name    (envB)?.toLowerCase()) &&
                   (public_env_name   (envA)?.toLowerCase() == public_env_name   (envB)?.toLowerCase()) &&
                   (foursight_env_name(envA)?.toLowerCase() == foursight_env_name(envB)?.toLowerCase());
        }
        else if (STR.HasValue(envB)) {
            envB = envB.toLowerCase();
            return (regular_env_name  (envA)?.toLowerCase() == envB) ||
                   (full_env_name     (envA)?.toLowerCase() == envB) ||
                   (short_env_name    (envA)?.toLowerCase() == envB) ||
                   (public_env_name   (envA)?.toLowerCase() == envB) ||
                   (foursight_env_name(envA)?.toLowerCase() == envB);
        }
        else {
            return false;
        }
    }
    else if (STR.HasValue(envA)) {
        if (UTIL.IsObject(envB)) {
            envA = envA.toLowerCase();
            return (regular_env_name  (envB)?.toLowerCase() == envA) ||
                   (full_env_name     (envB)?.toLowerCase() == envA) ||
                   (short_env_name    (envB)?.toLowerCase() == envA) ||
                   (public_env_name   (envB)?.toLowerCase() == envA) ||
                   (foursight_env_name(envB)?.toLowerCase() == envA);
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
