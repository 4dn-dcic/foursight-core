// -------------------------------------------------------------------------------------------------
// Server (React API) related functions.
// -------------------------------------------------------------------------------------------------

import ENV from './ENV';
import Context from './Context';
import STR from './STR';
import Type from './Type';

function GetUrl(path, env = true) {
    if (!STR.HasValue(path)) {
        path = "/"
    }
    else if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (Type.IsBoolean(env)) {
        if (env) {
            env = ENV.Current();
        }
    }
    if (STR.HasValue(env)) {
        path = "/" + env + path;
    }
    return Context.Server.BaseUrl() + path;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    BasePath: Context.Server.BasePath,
    BaseUrl:  Context.Server.BaseUrl,
    IsLocal:  Context.Server.IsLocal,
    Origin:   Context.Server.Origin,
    Url:      GetUrl
}
