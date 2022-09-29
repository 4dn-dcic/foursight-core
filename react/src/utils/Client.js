// -------------------------------------------------------------------------------------------------
// Client (React UI) related functions.
// -------------------------------------------------------------------------------------------------

import Context from './Context';
import Cookie from './Cookie';
import ENV from './ENV';
import PATH from './PATH';
import STR from './STR';
import Type from './Type';

// -------------------------------------------------------------------------------------------------
// Client URL functions.
// -------------------------------------------------------------------------------------------------

function GetHomeUrl() {
    return Context.Client.Origin() + GetPath("/home", ENV.Current());
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
    if (!STR.HasValue(path)) {
        path = GetCurrentLogicalPath();
    }
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    path = PATH.Normalize(path);
    if (Type.IsBoolean(env)) {
        if (env) {
            //
            // Use the current environment (from the current URL) for the given path.
            // If it doesn't exist (for some reason) use the default environemnet
            // from the global header data, if passed in.
            //
            env = ENV.Current();
            if (!STR.HasValue(env)) {
                if (STR.HasValue(envFallback)) {
                    env = envFallback;
                }
                else if (Type.IsObject(envFallback)) {
                    const header = envFallback;
                    // env = header.envs?.default;
                    env = ENV.Default(header);
                }
            }
        }

    }
    else if (Type.IsObject(env)) {
        const header = env;
        // env = header.envs?.default;
        env = ENV.Default(header);
        if (!STR.HasValue(env)) {
            if (STR.HasValue(envFallback)) {
                env = envFallback;
            }
            else if (Type.IsObject(envFallback)) {
                //
                // This would be weird but just for completeness.
                //
                const header = envFallback;
                // env = header.envs?.default;
                env = ENV.Default(header);
            }
        }
    }
    if (STR.HasValue(env)) {
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
    const currentPath = PATH.Normalize(window.location.pathname);
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
    if (ENV.IsFoursightFourfront(header)) {
        return "https://" +  ENV.PublicName(ENV.Current(), header) + ".4dnucleome.org/";
    }
    else {
        return "https://cgap.hms.harvard.edu/";
    }
}

// -------------------------------------------------------------------------------------------------
// Readonly mode related function.
// -------------------------------------------------------------------------------------------------

function IsReadOnlyMode(header) {
    return header?.readOnlyMode || Cookie.IsReadOnlyMode();
}

function SetReadOnlyMode(value, setHeader) {
    
    if (Type.IsBoolean(value)) {
        if (Type.IsFunction(setHeader)) {
            setHeader(e => ({...e, readOnlyMode: value}));
        }
        Cookie.SetReadOnlyMode(value);
    }
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    BasePath:        Context.Client.BasePath,
    BaseUrl:         Context.Client.BaseUrl,
    Domain:          Context.Client.Domain,
    HomeUrl:         GetHomeUrl,
    IsLocal:         Context.Client.IsLocal,
    IsReadOnlyMode:  IsReadOnlyMode,
    Origin:          Context.Client.Origin,
    Path:            GetPath,
    PortalLink:     GetPortalLink,
    SetReadOnlyMode: SetReadOnlyMode
}