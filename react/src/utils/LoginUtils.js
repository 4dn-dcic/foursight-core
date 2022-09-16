import { useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import GlobalContext from '../GlobalContext';
import * as URL from './URL';
import AUTH from './AUTH';
import CLIENT from './CLIENT';
import COOKIE from './COOKIE';
import ENV from './ENV';
import SERVER from './SERVER';
import STR from './STR';

export const Auth0CallbackUrl = () => {
    if (CLIENT.IsLocal()) {
        return SERVER.UrlAbs("/callback/");
    }
    else {
        return SERVER.UrlAbs("/api/callback/");
    }
}

export const ValidEnvRequired = ({ children }) => {
    CLIENT.NoteLastUrl();
    const [ header ] = useContext(GlobalContext);
    // return !isKnownEnv(CLIENT.Env(), header) ? <Navigate to={CLIENT.Path("/env")} replace /> : children;
    return !AUTH.IsKnownEnv(CLIENT.Env(), header) ? <Navigate to={CLIENT.Path("/env")} replace /> : children;
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
    else if (header.env && !AUTH.IsAllowedEnv(header.env, header)) {
        return <Navigate to={CLIENT.Path("/env")} replace />
    }
    else {
        return children;
    }
}
