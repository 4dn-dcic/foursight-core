import * as Utils from './Utils.js';

const _BASE_URL_PATH = "/api/react/";

function getCurrentUrlPath() {
    return window.location.pathname;
}

function normalizePath(value) {
    if (!Utils.isNonEmptyString(value)) {
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

export const Env = () => {
    const path = window.location?.pathname?.replace(_BASE_URL_PATH, "");
    if (!Utils.isNonEmptyString(path)) {
        return "";
    }
    const slash = path.indexOf("/");
    if (slash > 0) {
        return path.substring(0, slash);
    } else {
        return "";
    }
}

export const getLogicalPathFromUrlPath = () => {
    const path = window.location.pathname.replace(_BASE_URL_PATH, "");
    const slash = path.indexOf("/");
    if (slash > 0) {
        return path.substring(slash);
    } else {
        return "";
    }
}

export const Url = (path, env = undefined, info = undefined) => {
    //
    // TODO: Document this thoroughly and rename to Path.
    // If env is true and info is an objec then assume that object is the info objet from the 
    // server from which we will get the default environment name; if env is true and info
    // is null then get the environment name from the current URL.
    //
    if (!Utils.isNonEmptyString(path)) {
        path = getLogicalPathFromUrlPath();
    }
    else if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (Utils.isBoolean(env) && env) {
        env = Env();
        if (!Utils.isNonEmptyString(env) && Utils.isObject(info)) {
            if (info?.environ) {
                env = info?.environ["ENV_NAME"];
            }
        }
    }
    if (Utils.isNonEmptyString(env)) {
        return _BASE_URL_PATH + env + path;
    }
    else {
        let url;
        if (path.startsWith("/")) {
            url = _BASE_URL_PATH + path.substring(1);
        }
        else {
            url = _BASE_URL_PATH + path;
        }
        return url
    }
}
