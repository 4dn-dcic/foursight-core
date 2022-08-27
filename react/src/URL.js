import * as Utils from './Utils.js';

export const BASE_URL_PATH = "/api/react/";

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

export const getBaseUrlPath = () => {
    return BASE_URL_PATH + Env();
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
        return BASE_URL_PATH + path;
    }
}
