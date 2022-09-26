// -------------------------------------------------------------------------------------------------
// Environment related functions.
// -------------------------------------------------------------------------------------------------

import AUTH from './AUTH';
import CONTEXT from './CONTEXT';
import COOKIE from './COOKIE';
import PATH from './PATH';
import STR from './STR';
import TYPE from './TYPE';

// -------------------------------------------------------------------------------------------------
// Known environments related functions.
// -------------------------------------------------------------------------------------------------

function GetKnownEnvs(header) {
    return header?.known_envs || COOKIE.KnownEnvs();
}

function IsKnownEnv(env, header) {
    if ((STR.HasValue(env) || TYPE.IsObject(env)) && TYPE.IsObject(header)) {
        const knownEnvs = GetKnownEnvs(header);
        for (const knownEnv of knownEnvs) {
            if (AreSameEnvs(knownEnv, env)) {
                return true;
            }
        }
    }
    return false;
}

// -------------------------------------------------------------------------------------------------
// Default environment related functions.
// -------------------------------------------------------------------------------------------------

function GetDefaultEnv(header) {
    return header?.default_env || COOKIE.DefaultEnv();
}

function IsDefaultEnv(env, header) {
    return AreSameEnvs(GetDefaultEnv(header), env);
}

// -------------------------------------------------------------------------------------------------
// Allowed environments (authorization) related functions.
// -------------------------------------------------------------------------------------------------

function GetAllowedEnvs(header) {
    if (AUTH.IsFauxLoggedIn()) {
        //
        // If we are faux logged in then allow all environments since we we (the React API)
        // are not able to determine the list of allowed environment without a real authenticated
        // user; if we don't do this then the faux logged in user won't be able to do anything.
        //
        return GetKnownEnvs(header);
    }
    const allowedEnvs = header?.auth?.allowed_envs || COOKIE.AllowedEnvs();
    //
    // The list of known environments are of the annotated variety.
    // But the list of allowed environments is just a list of simple environment names.
    // We want to return the list of allowed environments as a list of the annotated variety.
    // We could maybe do this on the server-side, or at least at global header data fetch time.
    //
    const knownEnvs = GetKnownEnvs(header);
    let allowedEnvsAnnotated = [];
    for (const knownEnv of knownEnvs) {
        for (const allowedEnv of allowedEnvs) {
            if (AreSameEnvs(allowedEnv, knownEnv)) {
                allowedEnvsAnnotated.push(knownEnv);
            }
        }
    }
    return allowedEnvsAnnotated;
}

function IsAllowedEnv(env, header) {
    if ((STR.HasValue(env) || TYPE.IsObject(env)) && TYPE.IsObject(header)) {
        // TODO
        // This is not right. The allowed_envs list is just a simple list of env names
        // and we want to consider all name version possibilities via the known_envs list.
        //
        const allowedEnvs = GetAllowedEnvs(header);
        for (const allowedEnv of allowedEnvs) {
            if (AreSameEnvs(allowedEnv, env)) {
                return true;
            }
        }
    }
    return false;
}

// -------------------------------------------------------------------------------------------------
// Environment comparison related functions.
// -------------------------------------------------------------------------------------------------

// Returns true iff the given two environments refer to same environment.
// The arguments may be either strings and/or JSON objects from the global
// header data element containing the annotated environment names, i.e. which
// contains these elements: name, full_name, short_name, public_name, foursight_name.
//
function AreSameEnvs(envA, envB) {
    if (TYPE.IsObject(envA)) {
        if (TYPE.IsObject(envB)) {
            return (envA?.name?.toLowerCase()           === envB?.name?.toLowerCase()) ||
                   (envA?.full_name?.toLowerCase()      === envB?.full_name?.toLowerCase()) ||
                   (envA?.short_name?.toLowerCase()     === envB?.short_name?.toLowerCase()) ||
                   (envA?.public_name?.toLowerCase()    === envB?.public_name?.toLowerCase()) ||
                   (envA?.foursight_name?.toLowerCase() === envB?.foursight_name?.toLowerCase());
        }
        else if (STR.HasValue(envB)) {
            envB = envB.toLowerCase();
            return (envA?.name?.toLowerCase()           === envB) ||
                   (envA?.full_name?.toLowerCase()      === envB) ||
                   (envA?.short_name?.toLowerCase()     === envB) ||
                   (envA?.public_name?.toLowerCase()    === envB) ||
                   (envA?.foursight_name?.toLowerCase() === envB);
        }
        else {
            return false;
        }
    }
    else if (STR.HasValue(envA)) {
        if (TYPE.IsObject(envB)) {
            envA = envA.toLowerCase();
            return (envB?.name?.toLowerCase()           === envA) ||
                   (envB?.full_name?.toLowerCase()      === envA) ||
                   (envB?.short_name?.toLowerCase()     === envA) ||
                   (envB?.public_name?.toLowerCase()    === envA) ||
                   (envB?.foursight_name?.toLowerCase() === envA);
        }
        else if (STR.HasValue(envB)) {
            return envA.toLowerCase() === envB.toLowerCase();
        }
        else {
            return false;
        }
    }
    else {
        return false;
    }
}

// -------------------------------------------------------------------------------------------------
// Current environment related functions.
// -------------------------------------------------------------------------------------------------

// Returns the current environment from the URL.
// NOTE: If the given header is an object then we assume it is the global header data
// and in this case: if there is NO current environment (for some reason), or if the
// current environment is NOT known (according to the list of available/known environments in the
// given global header data), then return the default environment from this global header data object.
//
function GetCurrentEnv(header = null) {
    const currentPath = PATH.Normalize(CONTEXT.Client.CurrentPath());
    const basePathWithTrailingSlash = CONTEXT.Client.BasePath() + "/";
    let env = "";
    if (currentPath.startsWith(basePathWithTrailingSlash)) {
        const pathSansBasePath = currentPath.substring(basePathWithTrailingSlash.length);
        if (pathSansBasePath.length > 0) {
            const slash = pathSansBasePath.indexOf("/");
            env = (slash >= 0) ? pathSansBasePath.substring(0, slash) : pathSansBasePath;
        }
    }
    if (TYPE.IsObject(header)) {
        if (!IsKnownEnv(env, header)) {
            env = header?.default_env;
        }
    }
    return env;
}

function IsCurrentEnv(env) {
    return AreSameEnvs(GetCurrentEnv(), env);
}

function IsCurrentEnvKnown(header) {
    return IsKnownEnv(GetCurrentEnv(), header);
}

function IsCurrentEnvAllowed(header) {
    return IsAllowedEnv(GetCurrentEnv(), header);
}

// -------------------------------------------------------------------------------------------------
// Environment name variants related functions.
// -------------------------------------------------------------------------------------------------

function GetAnnotatedEnv(env, header) {
    if (TYPE.IsObject(env)) {
        return env;
    }
    else if (STR.HasValue(env)) {
        const knownEnvs = GetKnownEnvs(header);
        for (const knownEnv of knownEnvs) {
            if (AreSameEnvs(knownEnv, env)) {
                return knownEnv;
            }
        }
    }
    return null;
}

function GetRegularEnvName(env, header) {
    return GetAnnotatedEnv(env, header)?.name;
}

function GetPublicEnvName(env, header) {
    return GetAnnotatedEnv(env, header)?.public_name;
}

function GetFullEnvName(env, header) {
    return GetAnnotatedEnv(env, header)?.full_name;
}

function GetShortEnvName(env, header) {
    return GetAnnotatedEnv(env, header)?.short_name;
}

function GetFoursightEnvName(env, header) {
    return GetAnnotatedEnv(env, header)?.foursight_name;
}

function GetPreferredEnvName(env, header) {
    return IsFoursightFourfront(header) ? GetPublicEnvName(env) : GetFullEnvName(env);
}

// -------------------------------------------------------------------------------------------------
// Foursight-Fourfront vs. Foursight-CGAP and legacy Foursight related functions.
// -------------------------------------------------------------------------------------------------

function IsFoursightFourfront(header) {
    if (COOKIE.TestMode.HasFoursightFourfront()) {
        return true;
    }
    else if (COOKIE.TestMode.HasFoursightCgap()) {
        return false;
    }
    else {
        return header?.app?.package !== "foursight-cgap";
    }
}

function GetLegacyFoursightLink(header) {
    //
    // For Foursight-CGAP (as opposed to Foursight-Fourfront) going to just,
    // for example, /api/view/supertest, does not work, rather we want to
    // to, for example, /api/view/cgap-supertest. I.e. for Foursight-CGAP
    // use the full name and the public name for Foursight-Fourfront.
    //
    const env = (IsFoursightFourfront(header) ?
                 GetPublicEnvName(GetCurrentEnv(header), header) :
                 GetFullEnvName(GetCurrentEnv(header), header))
                || GetDefaultEnv(header);
    if (CONTEXT.IsLocalCrossOrigin()) {
        return CONTEXT.Server.Origin() + "/api/view/" + env;
    }
    else {
        return "/api/view/" + env;
    }
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    AllowedEnvs:          GetAllowedEnvs,
    Current:              GetCurrentEnv,
    Default:              GetDefaultEnv,
    Equals:               AreSameEnvs,
    FoursightName:        GetFoursightEnvName,
    FullName:             GetFullEnvName,
    IsAllowed:            IsAllowedEnv,
    IsCurrent:            IsCurrentEnv,
    IsCurrentAllowed:     IsCurrentEnvAllowed,
    IsCurrentKnown:       IsCurrentEnvKnown,
    IsDefault:            IsDefaultEnv,
    IsFoursightFourfront: IsFoursightFourfront,
    IsKnown:              IsKnownEnv,
    KnownEnvs:            GetKnownEnvs,
    LegacyFoursightLink:  GetLegacyFoursightLink,
    PreferredName:        GetPreferredEnvName,
    PublicName:           GetPublicEnvName,
    RegularName:          GetRegularEnvName,
    ShortName:            GetShortEnvName
}
