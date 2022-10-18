// -------------------------------------------------------------------------------------------------
// Server (React API) related functions.
// -------------------------------------------------------------------------------------------------

import Env from './Env';
import Context from './Context';
import Str from './Str';
import Type from './Type';

// Creates and returns an URL suitable for a server (React API) request for the given path.
// The given path should begin with a slash, but if it doesn't then one will be added.
// If the given env is a boolean and true then the current environment name will be
// prepended to the path. Or if the given env is a string then that will be used as
// the envrionment name to prepend. E.g. GetUrl("/info", true) will yield something like:
// https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/react/cgap-supertest/users
// Assuming the current environment is cgap-supertest.
//
function GetUrl(path, env = true) {
    if (!Str.HasValue(path)) {
        path = "/"
    }
    else if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (Type.IsBoolean(env)) {
        if (env) {
            env = Env.Current();
        }
    }
    if (Str.HasValue(env)) {
        path = "/" + env + path;
    }
    return Context.Server.BaseUrl() + path;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    BasePath: Context.Server.BasePath,
    BaseUrl:  Context.Server.BaseUrl,
    IsLocal:  Context.Server.IsLocal,
    Origin:   Context.Server.Origin,
    Url:      GetUrl
}; export default exports;
