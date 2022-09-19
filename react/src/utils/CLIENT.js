import ENV from './ENV';
import CONTEXT from './CONTEXT';
import PATH from './PATH';
import STR from './STR';
import TYPE from './TYPE';

// -------------------------------------------------------------------------------------------------
// Client URL functions.
// -------------------------------------------------------------------------------------------------

function GetHomeUrl() {
    return CONTEXT.Client.Origin() + GetPath("/home", ENV.Current());
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
    if (TYPE.IsBoolean(env)) {
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
                else if (TYPE.IsObject(envFallback)) {
                    const header = envFallback;
                    // env = header.envs?.default;
                    env = ENV.Default(header);
                }
            }
        }

    }
    else if (TYPE.IsObject(env)) {
        const header = env;
        // env = header.envs?.default;
        env = ENV.Default(header);
        if (!STR.HasValue(env)) {
            if (STR.HasValue(envFallback)) {
                env = envFallback;
            }
            else if (TYPE.IsObject(envFallback)) {
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
    path = CONTEXT.Client.BasePath() + path;
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
    }
    return path;
}

// -------------------------------------------------------------------------------------------------
// Current client path functions.
// -------------------------------------------------------------------------------------------------

function GetCurrentPath() {
    return window.location.pathname;
}

function GetCurrentLogicalPath() {
    const currentPath = PATH.Normalize(GetCurrentPath());
    const basePathWithTrailingSlash = CONTEXT.Client.BasePath() + "/";
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
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    BasePath:           CONTEXT.Client.BasePath,
    BaseUrl:            CONTEXT.Client.BaseUrl,
    Domain:             CONTEXT.Client.Domain,
    HomeUrl:            GetHomeUrl,
    IsLocal:            CONTEXT.Client.IsLocal,
    IsLocalCrossOrigin: CONTEXT.IsLocalCrossOrigin,
    Origin:             CONTEXT.Client.Origin,
    Path:               GetPath,

    Current: {
        Env:        ENV.Current,
        IsKnownEnv: ENV.IsCurrentKnown
    }
}
