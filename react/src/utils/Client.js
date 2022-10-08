// -------------------------------------------------------------------------------------------------
// Client (React UI) related functions.
// -------------------------------------------------------------------------------------------------

import Context from './Context';
import Cookie from './Cookie';
import Env from './Env';
import Path from './Path';
import Str from './Str';
import Type from './Type';

// -------------------------------------------------------------------------------------------------
// Client URL functions.
// -------------------------------------------------------------------------------------------------

function GetHomeUrl() {
    return Context.Client.Origin() + GetPath("/home", Env.Current());
}

// -------------------------------------------------------------------------------------------------
// Client path functions.
// -------------------------------------------------------------------------------------------------

// Returns a well-formed client (React UI) path for the given logical path.
// Uses the current environment (from the URL) by default, or if the env
// argument is given it will use that instead; if the env argument is false
// then will not include an environment (unusual if not erroneous); or if
// the env argument is an object then it is assumed to be the global header
// data object from which we will use the default environment.
//
function GetPath(path, env = true, envFallback = null) {
    if (!Str.HasValue(path)) {
        path = GetCurrentLogicalPath();
    }
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    path = Path.Normalize(path);
    if (Type.IsBoolean(env)) {
        if (env) {
            //
            // Use the current environment (from the current URL) for the given path.
            // If it doesn't exist (for some reason) use the default environemnet
            // from the global header data, if passed in.
            //
            env = Env.Current();
            if (!Str.HasValue(env)) {
                if (Str.HasValue(envFallback)) {
                    env = envFallback;
                }
                else if (Type.IsObject(envFallback)) {
                    const header = envFallback;
                    // env = header.envs?.default;
                    env = Env.Default(header);
                }
            }
        }

    }
    else if (Type.IsObject(env)) {
        const header = env;
        // env = header.envs?.default;
        env = Env.Default(header);
        if (!Str.HasValue(env)) {
            if (Str.HasValue(envFallback)) {
                env = envFallback;
            }
            else if (Type.IsObject(envFallback)) {
                //
                // This would be weird but just for completeness.
                //
                const header = envFallback;
                // env = header.envs?.default;
                env = Env.Default(header);
            }
        }
    }
    if (Str.HasValue(env)) {
        path = "/" + env + path;
    }
    path = Context.Client.BasePath() + path;
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
    }
    return path;
}

// -------------------------------------------------------------------------------------------------
// Current client path functions.
// -------------------------------------------------------------------------------------------------

function GetCurrentLogicalPath() {
    const currentPath = Path.Normalize(window.location.pathname);
    const basePathWithTrailingSlash = Context.Client.BasePath() + "/";
    if (currentPath.startsWith(basePathWithTrailingSlash)) {
        const pathSansBasePath = currentPath.substring(basePathWithTrailingSlash.length);
        if (pathSansBasePath.length > 0) {
            const slash = pathSansBasePath.indexOf("/");
            if (slash >= 0) {
                return pathSansBasePath.substring(slash);
            }
        }
    }
    return "";
}

// -------------------------------------------------------------------------------------------------
// Links functions.
// -------------------------------------------------------------------------------------------------

function GetPortalLink(header) {
    if (Env.IsFoursightFourfront(header)) {
        return "https://" +  Env.PublicName(Env.Current(), header) + ".4dnucleome.org/";
    }
    else {
        return "https://cgap.hms.harvard.edu/";
    }
}

// -------------------------------------------------------------------------------------------------
// Readonly mode related function.
// -------------------------------------------------------------------------------------------------

function IsReadOnlyMode(header) {
    return Cookie.IsReadOnlyMode();
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    BasePath:           Context.Client.BasePath,
    BaseUrl:            Context.Client.BaseUrl,
    CurrentLogicalPath: GetCurrentLogicalPath,
    Domain:             Context.Client.Domain,
    HomeUrl:            GetHomeUrl,
    IsLocal:            Context.Client.IsLocal,
    IsReadOnlyMode:     IsReadOnlyMode,
    Origin:             Context.Client.Origin,
    Path:               GetPath,
    PortalLink:         GetPortalLink
}; export default exports;
