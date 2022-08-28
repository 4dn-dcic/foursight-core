import * as Utils from './Utils.js';

const BASE_URL_PATH = "/api/react/";

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
    const path = window.location?.pathname?.replace(BASE_URL_PATH, "");
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
    const path = window.location.pathname.replace(BASE_URL_PATH, "");
    const slash = path.indexOf("/");
    if (slash > 0) {
        return path.substring(slash);
    } else {
        return "";
    }
}

export const Url = (path, env) => {
    if (!Utils.isNonEmptyString(path)) {
        path = getLogicalPathFromUrlPath();
    }
    else if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (Utils.isBoolean(env) && env) {
        env = Env();
    }
    if (Utils.isNonEmptyString(env)) {
        return BASE_URL_PATH + env + path;
    }
    else {
        let url;
        if (path.startsWith("/")) {
            url = BASE_URL_PATH + path.substring(1);
        }
        else {
            url = BASE_URL_PATH + path;
        }
        return url
    }
}
