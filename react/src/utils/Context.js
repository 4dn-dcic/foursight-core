// -------------------------------------------------------------------------------------------------
// Context (location) related functions.
// I.e. Locations of client (React UI), server (React API), authentication (Auth0).
// -------------------------------------------------------------------------------------------------

// N.B. If the client (React UI) is running locally (localhost) then assume the server (React API)
// is as well. Same deal actually if not running locally (otherwise CORS issues ensue). The only
// time these (UI and API) are different are when running locally (localhost) in cross-origin mode,
// e.g. with the client running on (localhost) port 3000 and the server running on (localhost) port
// 8000; when running the server locally, i.e. chalice local, we do setup CORS to allow cross-origin
// mode. It is currently not possible to run the client locally and the server not locally.
// See GetServerOrigin.
//
// N.B. There is currently no real support for running locally (localhost) using an explicitly
// specified, arbitrary hostname, e.g. via the /etc/hosts file. This is because Auth0 is only
// setup to recognize a specific (whitelisted) list of URLs for the authentication callback; 
// and a localhost URL is included, but the other URLs included are for real/existing
// instances running non-locally.
//

// const _CLIENT_BASE_PATH  = "/api/react";
const _CLIENT_BASE_PATH  = "/react";
// const _SERVER_BASE_PATH  = "/api/reactapi";
const _SERVER_BASE_PATH  = "/reactapi";
const _SERVER_LOCAL_PORT = 8000

// -------------------------------------------------------------------------------------------------
// Client (React UI) context info.
// -------------------------------------------------------------------------------------------------

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
    return window.location.hostname === "localhost";
}

// -------------------------------------------------------------------------------------------------
// Server (React API) context info.
// -------------------------------------------------------------------------------------------------

function GetServerOrigin() {
    if (IsLocalClient()) {
        if (_SERVER_LOCAL_PORT === 443) {
            return "https://localhost";
        }
        else if (_SERVER_LOCAL_PORT === 80) {
            return "http://localhost";
        }
        else {
            return "http://localhost:" + _SERVER_LOCAL_PORT;
        }
    }
    else {
        return window.location.origin;
    }
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
    return IsLocal() && GetClientOrigin() !== GetServerOrigin();
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {

    IsLocal:              IsLocal,
    IsLocalCrossOrigin:   IsLocalCrossOrigin,

    Client: {
        BasePath:         GetClientBasePath,
        BaseUrl:          GetClientBaseUrl,
        CurrentPath:      GetClientCurrentPath,
        Domain:           GetClientDomain,
        IsLocal:          IsLocalClient,
        Origin:           GetClientOrigin
    },
    Server: {
        IsLocal:           IsLocalServer,
        BasePath:          GetServerBasePath,
        BaseUrl:           GetServerBaseUrl,
        Origin:            GetServerOrigin
    },
}; export default exports;
