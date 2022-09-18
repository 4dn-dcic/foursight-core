// -------------------------------------------------------------------------------------------------
// Client (React UI) context info.
// -------------------------------------------------------------------------------------------------

const _CLIENT_BASE_PATH = "/api/react";

function GetClientOrigin() {
    return window.location.origin;
}

function GetClientDomain() {
    return window.location.hostname;
}

function GetClientBasePath() {
    return _CLIENT_BASE_PATH;
}

function GetClientBaseUrl() {
    return GetClientOrigin() + GetClientBasePath();
}

function GetClientCurrentPath() {
    return window.location.pathname;
}

function IsLocalClient() {
    const origin = GetClientOrigin();
    return origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
}

// -------------------------------------------------------------------------------------------------
// Server (React API) context info.
// -------------------------------------------------------------------------------------------------

const _SERVER_BASE_PATH  = "/api/reactapi";
const _SERVER_LOCAL_PORT = 8000

function GetServerOrigin() {
    //
    // N.B. If the client (React UI) is running locally then assume the server (React API) is as well.
    //
    return IsLocalClient() ? "http://localhost:" + _SERVER_LOCAL_PORT : window.location.origin;
}

function GetServerBasePath() {
    return _SERVER_BASE_PATH;
}

function GetServerBaseUrl() {
    return GetServerOrigin() + GetServerBasePath();
}

function IsLocalServer() {
    const origin = GetServerOrigin();
    return origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
}

// -------------------------------------------------------------------------------------------------
// Local context info.
// -------------------------------------------------------------------------------------------------

function IsLocal() {
    return IsLocalClient() && IsLocalServer();
}

// Returns true if running locally AND if running the client (React UI) on a different port
// thant the server (React API); this is the case when running the client via npm start,
// for better development with live UI updates (typically on port 3000), and running
// the server via chalice local (typically on port 8000).
//
function IsLocalCrossOrigin() {
    return IsLocal() && GetClientOrigin() != GetServerOrigin();
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {

    IsLocal:            IsLocal,
    IsLocalCrossOrigin: IsLocalCrossOrigin,

    Client: {
        BasePath:    GetClientBasePath,
        BaseUrl:     GetClientBaseUrl,
        CurrentPath: GetClientCurrentPath,
        Domain:      GetClientDomain,
        IsLocal:     IsLocalClient,
        Origin:      GetClientOrigin
    },

    Server: {
        IsLocal:  IsLocalServer,
        BasePath: GetServerBasePath,
        BaseUrl:  GetServerBaseUrl,
        Origin:   GetServerOrigin
    }
}
