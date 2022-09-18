import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import GlobalContext from './GlobalContext';
import AUTH from './utils/AUTH';
import ENV from './utils/ENV';
import CLIENT from './utils/CLIENT';
import COOKIE from './utils/COOKIE';

// If the current environment (from the URL) is NOT a known environment according
// to the envs.unique_annotated list in the auth record of the global header
// data (from the React API /header endpoint), then redirect to the /env page.
//
function KnownEnvRequired({ children }) {
    //
    // Maybe just NoteLastUrl on AuthorizationRequired pages,
    // i.e. all protected pages except the /login page.
    // NoteLastUrl();
    //
    const [ header ] = useContext(GlobalContext);
    //
    // TODO: More fully understand this next line added 2022-09-16.
    // If not here then going to the /login page redirects to the /env page because /header API is still in progress.
    // But thing that's a little confusing is we don't seem to need this kind of thing
    // in AuthorizationRequired below.
    //
    if (header.loading) return children;
    if (!ENV.IsKnown(CLIENT.Current.Env(), header) ) {
        console.log("XYZZY:REDIRECT TO /env (a)");
        return <Navigate to={CLIENT.Path("/env")} replace />
    }
    else {
        return children;
    }
    // return !AUTH.IsKnownEnv(CLIENT.Current.Env(), header) ? <Navigate to={CLIENT.Path("/env")} replace /> : children;
}

// If the user is NOT authenticated (i.e. logged in) OR is NOT authorized for the current
// environment (i.e. if authenticated user is NOT allowed to access the environment from
// the current URL, according to the allowed_envs list in the auth record of the global
// header data (from the React API /header endpoint), then redirect to either the /login
// page, if not authenticated, or to the /env page, if authenticated by not authorized.
//
function AuthorizationRequired({ children }) {
    NoteLastUrl();
    const [ header ] = useContext(GlobalContext);
    //
    // TODO: Should we add this here too like above?
    //       if (header.loading) return children;
    //
    if (CLIENT.Current.Env() === "" || header.env_unknown) {
        console.log("XYZZY:REDIRECT TO /env (b)");
        return <Navigate to={CLIENT.Path("/env")} replace />
    }
    else if (!AUTH.IsLoggedIn(header)) {
        console.log("XYZZY:REDIRECT TO /login (c)");
        console.log(header);
        return <Navigate to={CLIENT.Path("/login")} replace />
    }
    else if (!ENV.IsAllowed(ENV.Current(), header)) {
        console.log("XYZZY:REDIRECT TO /env (d)");
        return <Navigate to={CLIENT.Path("/env")} replace />
    }
    else {
        return children;
    }
}

function NoteLastUrl() {
    COOKIE.SetLastUrl(window.location.href);
}

function GetLastUrl() {
    return COOKIE.GetLastUrl();
}

function GetLastPath() {
    const lastUrl = GetLastUrl();
    const baseUrl = CLIENT.BaseUrl();
    if (lastUrl.startsWith(baseUrl)) {
        return CLIENT.Path(lastUrl.substring(baseUrl.length), false);
    }
    return lastUrl;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    AuthorizationRequired: AuthorizationRequired,
    KnownEnvRequired:      KnownEnvRequired,
    LastPath:              GetLastPath,
    LastUrl:               GetLastUrl,
    NoteLastUrl:           NoteLastUrl
}
