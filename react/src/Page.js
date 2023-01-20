import { Navigate } from 'react-router-dom';
import Auth from './utils/Auth';
import Env from './utils/Env';
import Client from './utils/Client';
import Cookie from './utils/Cookie';
import useHeader from './hooks/Header';

// -------------------------------------------------------------------------------------------------
// Page guards.
// -------------------------------------------------------------------------------------------------

// If the current environment (from the URL) is NOT a known environment according
// to the envs.unique_annotated list in the auth record of the global header
// data (from the React API /header endpoint), then redirect to the /env page.
//
function KnownEnvRequired({ children }) {
    const header = useHeader();
    //
    // TODO: More fully understand this next line added 2022-09-16.
    // If not here then going to the /login page redirects to the /env page because /header API is still in progress.
    // But thing that's a little confusing is we don't seem to need this kind of thing
    // in AuthorizationRequired below.
    //
    if (header.loading) return children;
    if (!Env.IsKnown(Env.Current(), header) ) {
        return RedirectToKnownEnvPath(header);
    }
    else {
        NoteLastUrl();
        return children;
    }
}

function RedirectToKnownEnvPath(header) {
    const path = Client.Path(Client.CurrentLogicalPath(), Env.PreferredName(Env.Default(header), header));
    window.location.href = path;
}

// If the user is NOT authenticated (i.e. logged in) OR is NOT authorized for the current
// environment (i.e. if authenticated user is NOT allowed to access the environment from
// the current URL, according to the allowed_envs list in the auth record of the global
// header data (from the React API /header endpoint), then redirect to either the /login
// page, if not authenticated, or to the /env page, if authenticated but not authorized.
//
function AuthorizationRequired({ children }) {
    const header = useHeader();
    if (!Auth.IsLoggedIn(header)) {
        return <Navigate to={Client.Path("/login")} replace />
    }
    else if (!Env.IsKnown(Env.Current(), header)) {
        return RedirectToKnownEnvPath(header); // NEW
    }
    else if (!Env.IsAllowed(Env.Current(), header)) {
        return <Navigate to={Client.Path("/env")} replace />
    }
    else {
        NoteLastUrl();
        return children;
    }
}

// -------------------------------------------------------------------------------------------------
// Last path/URL related fnctions.
// -------------------------------------------------------------------------------------------------

function NoteLastUrl(header) {
    if (Env.IsKnown(Env.Current(), header)) {
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
