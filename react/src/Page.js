import { Navigate } from 'react-router-dom';
import Auth from './utils/Auth';
import Env from './utils/Env';
import Client from './utils/Client';
import Cookie from './utils/Cookie';
import useHeader from './hooks/Header';
import FatalErrorPage from './pages/FatalErrorPage';

// -------------------------------------------------------------------------------------------------
// Page guards.
// -------------------------------------------------------------------------------------------------

// If the current environment (from the URL) is NOT a known environment according
// to the envs.unique_annotated list in the auth record of the global header
// data (from the React API /header endpoint), then redirect to the /env page.
//
function KnownEnvRequired({ children }) {
    const header = useHeader();
    if (FatalErrorPage.IsFatalError(header)) {
        return <Navigate to={Client.Path("/error")} replace />
    }
    else if (SanityCheckPath()) {
        return;
    }
    //
    // TODO: More fully understand this next line added 2022-09-16.
    // If not here then going to the /login page redirects to the /env page because /header API is still in progress.
    // But thing that's a little confusing is we don't seem to need this kind of thing
    // in AuthorizationRequired below.
    //
    if (header.loading) return children;
    if (!Env.IsKnown(Env.Current(), header) ) {
        return RedirectToDefaultEnvPath(header);
    }
    else {
        NoteLastUrl();
        return children;
    }
}

function RedirectToDefaultEnvPath(header) {
    const env = Env.PreferredName(Env.Default(header), header);
    if (Env.IsKnown(env, header)) {
        const path = Client.Path(Client.CurrentLogicalPath(), env);
        if (path !== window.location.href) {
            window.location.href = path;
        }
    }
}

function SanityCheckPath() {
    const path = window.location.pathname;
    const components = path.substring(1).split("/");
    if ((components.length >= 2) && ((components[0] !== "api") || (components[1] !== "react"))) {
        //
        // Catch specifically if we have a path without the required leading /api/react.
        // This came up for example (C4-972) when we are on the Foursight Legacy site, e.g.
        // at https://foursight.4dnucleome.org/view/webdev and then click on the link to go to
        // Foursight React and it takes us to https://foursight.4dnucleome.org/api/react/login/env
        // where the page complain about unknown environment "login" which is confusing; happens
        // because the Foursight React link is https://foursight.4dnucleome.org/react/webdev/home
        // i.e. lacking the required "/api"; could handle it at the link creation time but more
        // robust just to catch it here more generally on the React side. And FYI note that it
        // is unclear how that initial URL (https://foursight.4dnucleome.org/view/webdev) was
        // navigated to in the first place; that should also have a "/api" prefix on the path.
        //
        if (components[0] === "react") {
            window.location.pathname = `/api/${components.join("/")}`;
            return true;
        }
        else {
            if (components[0] === "api") {
                components.shift();
            }
            window.location.pathname = `/api/react/${components.join("/")}`;
            return true;
        }
    }
    return false;
}

// If the user is NOT authenticated (i.e. logged in) OR is NOT authorized for the current
// environment (i.e. if authenticated user is NOT allowed to access the environment from
// the current URL, according to the allowed_envs list in the auth record of the global
// header data (from the React API /header endpoint), then redirect to either the /login
// page, if not authenticated, or to the /env page, if authenticated but not authorized.
//
function AuthorizationRequired({ children }) {
    const header = useHeader();
    if (FatalErrorPage.IsFatalError(header)) {
        return <Navigate to={Client.Path("/error")} replace />
    }
    else if (SanityCheckPath()) {
        return;
    }
    else if (!Auth.IsLoggedIn(header)) {
        return <Navigate to={Client.Path("/login")} replace />
    }
    else if (!Env.IsKnown(Env.Current(), header)) {
        return RedirectToDefaultEnvPath(header);
    }
    else if (!Env.IsAllowed(Env.Current(), header)) {
        return <Navigate to={Client.Path("/env")} replace />
    }
    else {
        NoteLastUrl();
        return children;
    }
}

function Unprotected({ children }) {
    return children;
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
    NoteLastUrl:           NoteLastUrl,
    Unprotected:           Unprotected
};
export default Exports;
