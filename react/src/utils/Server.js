// -------------------------------------------------------------------------------------------------
// Server (React API) related functions.
// -------------------------------------------------------------------------------------------------

import Env from './Env';
import Context from './Context';
import Str from './Str';
import Type from './Type';

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

export default {
    BasePath: Context.Server.BasePath,
    BaseUrl:  Context.Server.BaseUrl,
    IsLocal:  Context.Server.IsLocal,
    Origin:   Context.Server.Origin,
    Url:      GetUrl
}
