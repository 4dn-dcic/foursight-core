import { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import Global from './Global';
import Auth from './utils/Auth';
import Env from './utils/Env';
import Client from './utils/Client';
import Cookie from './utils/Cookie';

// -------------------------------------------------------------------------------------------------
// Page guards.
// -------------------------------------------------------------------------------------------------

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
    const [ header ] = useContext(Global);
    //
    // TODO: More fully understand this next line added 2022-09-16.
    // If not here then going to the /login page redirects to the /env page because /header API is still in progress.
    // But thing that's a little confusing is we don't seem to need this kind of thing
    // in AuthorizationRequired below.
    //
    if (header.loading) return children;
    if (!Env.IsKnown(Env.Current(), header) ) {
        console.log("XYZZY:REDIRECT TO /env (a)");
        return <Navigate to={Client.Path("/env")} replace />
    }
    else {
        return children;
    }
}

// If the user is NOT authenticated (i.e. logged in) OR is NOT authorized for the current
// environment (i.e. if authenticated user is NOT allowed to access the environment from
// the current URL, according to the allowed_envs list in the auth record of the global
// header data (from the React API /header endpoint), then redirect to either the /login
// page, if not authenticated, or to the /env page, if authenticated by not authorized.
//
function AuthorizationRequired({ children }) {
    const [ header ] = useContext(Global);
    NoteLastUrl(header);
    if (!Auth.IsLoggedIn(header)) {
        console.log("XYZZY:REDIRECT TO /login (c)");
        console.log(header);
        return <Navigate to={Client.Path("/login")} replace />
    }
    else if (!Env.IsAllowed(Env.Current(), header)) {
        console.log("XYZZY:REDIRECT TO /env (d)");
        return <Navigate to={Client.Path("/env")} replace />
    }
    else if (!Env.IsCurrentKnown(header)) {
        console.log("XYZZY:REDIRECT TO /env (b)");
        return <Navigate to={Client.Path("/env")} replace />
    }
    else {
        return children;
    }
}

// -------------------------------------------------------------------------------------------------
// Last path/URL related fnctions.
// -------------------------------------------------------------------------------------------------

function NoteLastUrl(header) {
    if (Env.IsCurrentKnown(header)) {
        Cookie.SetLastUrl(window.location.href);
    }
}

function GetLastUrl() {
    return Cookie.LastUrl() || Client.HomeUrl();
}

function GetLastPath() {
    const lastUrl = GetLastUrl();
    const baseUrl = Client.BaseUrl();
    if (lastUrl.startsWith(baseUrl)) {
        return Client.Path(lastUrl.substring(baseUrl.length), false);
    }
    return lastUrl;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    AuthorizationRequired: AuthorizationRequired,
    KnownEnvRequired:      KnownEnvRequired,
    LastPath:              GetLastPath,
    LastUrl:               GetLastUrl,
    NoteLastUrl:           NoteLastUrl
};
export default Exports;
