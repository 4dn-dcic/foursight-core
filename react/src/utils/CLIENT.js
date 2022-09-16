import COOKIE from './COOKIE';
import LOC from './LOC';
import STR from './STR';
import UTIL from './UTIL';

function IsLocal() {
    return LOC.IsLocalClient();
}

function IsLocalCrossOrigin() {
    return LOC.IsLocalCrossOrigin();
}

function GetOrigin() {
    return LOC.ClientOrigin();
}

function GetBasePath() {
    return LOC.ClientBasePath();
}

function GetBaseUrl() {
    return GetOrigin() + GetBasePath();
}

function GetUrl(path) {
    if (!STR.HasValue(path)) {
        path = "/"
    }
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    return GetBaseUrl() + path;
}

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
    path = NormalizePath(path);
    if (UTIL.IsBoolean(env)) {
        if (env) {
            //
            // Use the current environment (from the current URL) for the given path.
            // If it doesn't exist (for some reason) use the default environemnet
            // from the global header data, if passed in.
            //
            env = GetCurrentEnv();
            if (!STR.HasValue(env)) {
                if (STR.HasValue(envFallback)) {
                    env = envFallback;
                }
                else if (UTIL.IsObject(envFallback)) {
                    const header = envFallback;
                    env = header.envs?.default;
                }
            }
        }

    }
    else if (UTIL.IsObject(env)) {
        const header = env;
        env = header.envs?.default;
        if (!STR.HasValue(env)) {
            if (STR.HasValue(envFallback)) {
                env = envFallback;
            }
            else if (UTIL.IsObject(envFallback)) {
                //
                // This would be weird but just for completeness.
                //
                const header = envFallback;
                env = header.envs?.default;
            }
        }
    }
    if (STR.HasValue(env)) {
        path = "/" + env + path;
    }
    path = GetBasePath() + path;
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
    }
    return path;
}

function GetCurrentPath() {
    return window.location.pathname;
}

function GetCurrentLogicalPath() {
    const currentPath = NormalizePath(GetCurrentPath());
    const basePathWithTrailingSlash = GetBasePath() + "/";
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

// Returns the current environment from the URL.
//
// If the given header is an object then we assume it is the global header data
// and in this case: if there is NO current environment (for some reason), or if the
// current environment is NOT known (according to the list of available environments
// in the given global header data), then return the default environment from this object.
//
function GetCurrentEnv(header = null) {
    const currentPath = NormalizePath(GetCurrentPath());
    const basePathWithTrailingSlash = GetBasePath() + "/";
    let env = "";
    if (currentPath.startsWith(basePathWithTrailingSlash)) {
        const pathSansBasePath = currentPath.substring(basePathWithTrailingSlash.length);
        if (pathSansBasePath.length > 0) {
            const slash = pathSansBasePath.indexOf("/");
            env = (slash >= 0) ? pathSansBasePath.substring(0, slash) : pathSansBasePath;
        }
    }
    if (UTIL.IsObject(header)) {
        if (!IsKnownEnv(env)) {
            env = header.envs?.default;
        }
    }
    return env;
}

function IsKnownEnv(env, header) {
    if (!STR.HasValue(env) || !UTIL.IsObject(header)) {
        return false;
    }
    env = env.toLowerCase();
    for (let i = 0 ; i < header.envs?.unique_annotated?.length ; i++) {
        const env_annotated = header.envs?.unique_annotated[i];
        if ((env_annotated.name.toLowerCase() == env) ||
            (env_annotated.full_name.toLowerCase() == env) ||
            (env_annotated.short_name.toLowerCase() == env) ||
            (env_annotated.public_name.toLowerCase() == env) ||
            (env_annotated.foursight_name.toLowerCase() == env)) {
            return true;
        }
    }
    return false;
}

function NoteLastUrl() {
    COOKIE.SetLastUrl(window.location.href);
}

function LastUrl() {
    return COOKIE.GetLastUrl();
}

function LastPath() {
    const lastUrl = LastUrl();
    const baseUrl = GetBaseUrl();
    if (lastUrl.startsWith(baseUrl)) {
        return GetPath(lastUrl.substring(baseUrl.length), false);
    }
    return lastUrl;
}

function NormalizePath(path) {
    if (!STR.HasValue(path)) {
        return "";
    }
    path = path.replace(/\/+/g, "/");
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1)
    }
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    return path;
}

export default {
    BasePath:           GetBasePath,
    BaseUrl:            GetBaseUrl,
    CurrentPath:        GetCurrentPath,
    CurrentLogicalPath: GetCurrentLogicalPath,
    Env:                GetCurrentEnv,
    IsKnownEnv:         IsKnownEnv,
    IsLocal:            IsLocal,
    IsLocalCrossOrigin: IsLocalCrossOrigin,
    LastPath:           LastPath,
    LastUrl:            LastUrl,
    NoteLastUrl:        NoteLastUrl,
    Origin:             GetOrigin,
    Path:               GetPath,
    Url:                GetUrl
}
