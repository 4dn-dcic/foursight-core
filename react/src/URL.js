import * as Utils from './Utils.js';

export const BASE_URL_PATH = "/api/react/";

export const Env = () => {
        console.log('URL:Env')
    const path = window.location?.pathname?.replace(BASE_URL_PATH, "");
        console.log(path)
    if (!Utils.isNonEmptyString(path)) {
        console.log('111')
        return "";
    }
    const slash = path.indexOf("/");
        console.log('222')
    if (slash > 0) {
        console.log('333')
        return path.substring(0, slash);
    } else {
        console.log('rrr')
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
        path = "/";
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
