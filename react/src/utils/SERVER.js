// -------------------------------------------------------------------------------------------------
// Server (React API) related functions.
// -------------------------------------------------------------------------------------------------

import ENV from './ENV';
import CONTEXT from './CONTEXT';
import STR from './STR';
import TYPE from './TYPE';

function GetUrl(path, env = true) {
    if (!STR.HasValue(path)) {
        path = "/"
    }
    else if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (TYPE.IsBoolean(env)) {
        if (env) {
            env = ENV.Current();
        }
    }
    if (STR.HasValue(env)) {
        path = "/" + env + path;
    }
    return CONTEXT.Server.BaseUrl() + path;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    BasePath: CONTEXT.Server.BasePath,
    BaseUrl:  CONTEXT.Server.BaseUrl,
    IsLocal:  CONTEXT.Server.IsLocal,
    Origin:   CONTEXT.Server.Origin,
    Url:      GetUrl
}
