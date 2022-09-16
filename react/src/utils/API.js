import * as Utils from './Utils';
import * as URL from './URL';
import * as LoginUtils from './LoginUtils';
import AUTH from './AUTH';
import CLIENT from './CLIENT';
import STR from './STR';
import UTIL from './UTIL';

export const API_BASE_URL_PATH = "/api/reactapi";

export const getApiBaseUrl = () => {
    let baseDomainUrl;
    if (CLIENT.IsLocal()) {
        baseDomainUrl = "http://" + window.location.hostname + ":8000";
    } else {
        baseDomainUrl = window.origin;
    }
    return baseDomainUrl;
}

export const getApiBaseUrlWithPath = () => {
    return getApiBaseUrl() + API_BASE_URL_PATH;
}

export const Url = (path, env = null) => {
    if (!UTIL.IsNonEmptyString(path)) {
        path = "/";
    }
    else if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (Utils.isBoolean(env) && env) {
        env = CLIENT.Env();
    }
    if (UTIL.IsNonEmptyString(env)) {
        return getApiBaseUrlWithPath() + "/" + env + path;
    }
    else {
        return getApiBaseUrlWithPath() + path;
    }
}

export const UrlAbs = (path) => {
    if (!UTIL.IsNonEmptyString(path)) {
        path = "/";
    }
    return getApiBaseUrl() + path;
}
