import STR from './STR';
import UTIL from './UTIL';

const BASE_URL_PATH = "/api/react/";

export const getCurrentUrlPath = () => {
    return window.location.pathname;
}

function normalizePath(value) {
    if (!STR.HasValue(value)) {
        return "";
    }
    const valueLowerCase = value.toLowerCase();
    if (valueLowerCase.startsWith("http://")) {
        value = value.substring(7);
        const slash = value.indexOf("/")
        if (slash === -1) return "/";
        value = value.substring(slash);
    }
    else if (valueLowerCase.startsWith("https://")) {
        value = value.substring(8);
        const slash = value.indexOf("/")
        if (slash === -1) return "/";
        value = value.substring(slash);
    }
    value = value.replace(/\/+/g, "/");
    if (value.endsWith("/")) {
        value = value.substring(0, value.length - 1)
    }
    if (!value.startsWith("/")) {
        value = "/" + value;
    }
    return value;
}

// Returns the environment portion of the path.
// Assume the path has the form: /api/react/{environment}/{path}
//
export const Env = (path = undefined) => {
    if (!STR.HasValue(path)) {
        path = getCurrentUrlPath();
    }
    path = normalizePath(path);
    if (path.startsWith(BASE_URL_PATH)) {
        path = path.replace(BASE_URL_PATH, "");
    }
    else if (path.startsWith("/")) {
        path = path.substring(1);
    }
    if (!STR.HasValue(path)) {
        return "";
    }
    const slash = path.indexOf("/");
    const env = (slash === -1) ? "" : path.substring(0, slash);
    path = (slash === -1) ? "" : path.substring(slash);
    if ((env == "api") && (path == "/react")) {
        return "";
    }
    return env;
}

// Returns the path portion of the path minus the environment and the App URL prefix (i.e. /api/react).
// Assume the path has the form: /api/react/{environment}/{path}
//
export const getLogicalPathFromUrlPath = (path = undefined) => {
    if (!STR.HasValue(path)) {
        path = getCurrentUrlPath();
    }
    path = normalizePath(path);
    if (path.startsWith(BASE_URL_PATH)) {
        path = path.replace(BASE_URL_PATH, "");
    }
    else if (path.startsWith("/")) {
        path = path.substring(1);
    }
    const slash = path.indexOf("/");
    return (slash == -1) ? "/" : path.substring(slash);
}

export const Url = (path = undefined, env = undefined, info = undefined) => {
    if (!STR.HasValue(path)) {
        path = getLogicalPathFromUrlPath()
    }
    path = normalizePath(path);
    if (path.startsWith(BASE_URL_PATH)) {
        path = path.replace(BASE_URL_PATH, "/");
    }
    if (UTIL.IsBoolean(env)) {
        if (env) {
            env = Env();
            if (!STR.HasValue(env) && UTIL.IsObject(info)) {
                if (info?.environ) {
                    env = info?.environ["ENV_NAME"];
                }
            }
        }
        else {
            if (UTIL.IsObject(info)) {
                if (info?.environ) {
                    env = info?.environ["ENV_NAME"];
                }
            }
        }
    }
    if (!STR.HasValue(env)) {
        env = ""
    }
    return normalizePath(BASE_URL_PATH + env + path);
}
