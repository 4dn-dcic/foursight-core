import { useContext } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import GlobalContext from '../GlobalContext';
import AUTH from './AUTH';
import CLIENT from './CLIENT';
import COOKIE from './COOKIE';
import ENV from './ENV';
import SERVER from './SERVER';
import STR from './STR';

export const ValidEnvRequired = ({ children }) => {
    CLIENT.NoteLastUrl();
    const [ header ] = useContext(GlobalContext);
    // return !isKnownEnv(CLIENT.Env(), header) ? <Navigate to={CLIENT.Path("/env")} replace /> : children;
    return !AUTH.IsKnownEnv(CLIENT.Env(), header) ? <Navigate to={CLIENT.Path("/env")} replace /> : children;
}

export const LoginAndValidEnvRequired = ({ children }) => {
    console.log('LoginAndValidEnvRequired')
    CLIENT.NoteLastUrl();
    const [ header ] = useContext(GlobalContext);
    if (CLIENT.Env() === "" || header.env_unknown) {
    console.log('LoginAndValidEnvRequired-A')
        return <Navigate to={CLIENT.Path("/env")} replace />
    }
    else if (!AUTH.IsLoggedIn(header)) {
    console.log('LoginAndValidEnvRequired-B')
        return <Navigate to={CLIENT.Path("/login")} replace />
    }
    else if (header.env && !AUTH.IsAllowedEnv(header.env, header)) {
    console.log('LoginAndValidEnvRequired-C')
        return <Navigate to={CLIENT.Path("/env")} replace />
    }
    else {
    console.log('LoginAndValidEnvRequired-D')
        return children;
    }
}
