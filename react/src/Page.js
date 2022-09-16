import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import GlobalContext from './GlobalContext';
import AUTH from './utils/AUTH';
import CLIENT from './utils/CLIENT';

// If the current environment (from the URL) is NOT a known environment according
// to the envs.unique_annotated list in the auth record of the global header
// data (from the React API /header endpoint), then redirect to the /env page.
//
export const KnownEnvRequired = ({ children }) => {
    CLIENT.NoteLastUrl();
    const [ header ] = useContext(GlobalContext);
    //
    // TODO: More fully understand this next line added 2022-09-16.
    // If not here then going to the /login page redirects to the /env page because /header API is still in progress.
    // But thing that's a little confusing is we don't seem to need this kind of thing
    // in AuthorizationRequired below.
    //
    if (header.loading) return children;
    return !AUTH.IsKnownEnv(CLIENT.Env(), header) ? <Navigate to={CLIENT.Path("/env")} replace /> : children;
}

// If the user is NOT authenticated (i.e. logged in) OR is NOT authorized for the current
// environment (i.e. if authenticated user is NOT allowed to access the environment from
// the current URL, according to the allowed_envs list in the auth record of the global
// header data (from the React API /header endpoint), then redirect to either the /login
// page, if not authenticated, or to the /env page, if authenticated by not authorized.
//
export const AuthorizationRequired = ({ children }) => {
    CLIENT.NoteLastUrl();
    const [ header ] = useContext(GlobalContext);
    //
    // TODO: Should we add this here too like above?
    //       if (header.loading) return children;
    //
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

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    AuthorizationRequired: AuthorizationRequired,
    KnownEnvRequired:      KnownEnvRequired
}
