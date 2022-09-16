import CLIENT from './CLIENT';
import LOC from './LOC';
import STR from './STR';
import UTIL from './UTIL';

function IsLocal() {
    return LOC.IsLocalServer();
}

function IsLocalCrossOrigin() {
    return LOC.IsLocalCrossOrigin();
}

function GetOrigin() {
    return LOC.ServerOrigin();
}

function GetBasePath() {
    return LOC.ServerBasePath();
}

function GetBaseUrl() {
    return GetOrigin() + GetBasePath();
}

function GetUrl(path, env = true) {
    if (!STR.HasValue(path)) {
        path = "/"
    }
    else if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (UTIL.IsBoolean(env)) {
        if (env) {
            env = CLIENT.Env();
        }
    }
    if (STR.HasValue(env)) {
        path = "/" + env + path;
    }
    return GetBaseUrl() + path;
}

function GetUrlAbs(path) {
    if (!STR.HasValue(path)) {
        path = "/";
    }
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    path = path.replace(/\/+/g, "/");
    return GetOrigin() + path;
}

export default {
    BasePath:           GetBasePath,
    BaseUrl:            GetBaseUrl,
    IsLocal:            IsLocal,
    IsLocalCrossOrigin: IsLocalCrossOrigin,
    Origin:             GetOrigin,
    Url:                GetUrl,
    UrlAbs:             GetUrlAbs
}
