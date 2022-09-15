import CLIENT from './CLIENT';
import UTIL from './UTIL';

const _SERVER_LOCALHOST_PORT = 8000
//
// If the client (React UI) is running locally
// then assume the server (React API) is as well.
//
const _SERVER_ORIGIN = CLIENT.IsLocal() ? "http://localhost:" + _SERVER_LOCALHOST_PORT : window.location.origin;
const _SERVER_BASE_PATH = "/api/reactapi";

function IsRunningLocally(header) {
    const origin = GetOrigin();
    return origin == "localhost" || origin == "127.0.0.1";
}

function GetOrigin() {
    return _SERVER_ORIGIN;
}

function GetBasePath() {
    return _SERVER_BASE_PATH;
}

function GetBaseUrl() {
    return GetOrigin() + GetBasePath();
}

function GetUrl(path, env = null) {
    if (!UTIL.IsNonEmptyString(path)) {
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
    if (UTIL.IsNonEmptyString(env)) {
        path = "/" + env + path;
    }
    return GetBaseUrl() + path;
}

export default {
    BasePath: GetBasePath,
    BaseUrl: GetBaseUrl,
    IsLocal: IsRunningLocally,
    Origin: GetOrigin,
    Url: GetUrl
}
