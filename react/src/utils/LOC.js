// -------------------------------------------------------------------------------------------------
// Client (React UI) location info.
// -------------------------------------------------------------------------------------------------

const _CLIENT_BASE_PATH = "/api/react";

function ClientOrigin() {
    return window.location.origin;
}

function ClientBasePath() {
    return _CLIENT_BASE_PATH;
}

// -------------------------------------------------------------------------------------------------
// Server (React API) location info.
// -------------------------------------------------------------------------------------------------

const _SERVER_BASE_PATH  = "/api/reactapi";
const _SERVER_LOCAL_PORT = 8000

function ServerOrigin() {
    //
    // N.B. If the client (React UI) is running locally then assume the server (React API) is as well.
    //
    return IsLocalClient() ? "http://localhost:" + _SERVER_LOCAL_PORT : window.location.origin;
}

function ServerBasePath() {
    return _SERVER_BASE_PATH;
}

// -------------------------------------------------------------------------------------------------
// Running local info.
// -------------------------------------------------------------------------------------------------

function IsLocalClient() {
    const origin = ClientOrigin();
    return origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
}

function IsLocalServer() {
    const origin = ServerOrigin();
    return origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:");
}

function IsLocal() {
    return IsLocalClient() && IsLocalServer();
}

// Returns true if running locally AND if running the client (React UI) on a different port
// thant the server (React API); this is the case when running the client via npm start,
// for better development with live UI updates (typically on port 3000), and running
// the server via chalice local (typically on port 8000).
//
function IsLocalCrossOrigin() {
    return IsLocal() && ClientOrigin() != ServerOrigin();
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    ClientBasePath:     ClientBasePath,
    ClientOrigin:       ClientOrigin,
    IsLocal:            IsLocal,
    IsLocalClient:      IsLocalClient,
    IsLocalCrossOrigin: IsLocalCrossOrigin,
    IsLocalServer:      IsLocalServer,
    ServerBasePath:     ServerBasePath,
    ServerOrigin:       ServerOrigin
}
