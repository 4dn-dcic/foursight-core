import * as Utils from './Utils';
import * as URL from './URL';

export const API_BASE_URL_PATH = "/api/reactapi";

export const getApiBaseUrl = () => {
    let baseDomainUrl;
    if (Utils.isRunningLocally()) {
        baseDomainUrl = "http://localhost:8000";
    } else {
        baseDomainUrl = window.origin;
    }
    return baseDomainUrl;
}

export const getApiBaseUrlWithPath = () => {
    return getApiBaseUrl() + API_BASE_URL_PATH;
}

export const Url = (path, env = undefined) => {
    if (!Utils.isNonEmptyString(path)) {
        path = "/";
    }
    else if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (Utils.isBoolean(env) && env) {
        env = URL.Env();
    }
    if (Utils.isNonEmptyString(env)) {
        return getApiBaseUrlWithPath() + "/" + env + path;
    }
    else {
        return getApiBaseUrlWithPath() + path;
    }
}

export const UrlAbs = (path) => {
    if (!Utils.isNonEmptyString(path)) {
        path = "/";
    }
    return getApiBaseUrl() + path;
}
