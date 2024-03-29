// -------------------------------------------------------------------------------------------------
// Environment related functions.
// -------------------------------------------------------------------------------------------------

import Context from './Context';
import Cookie from './Cookie';
import Path from './Path';
import Str from './Str';
import Type from './Type';

const FoursightTitleFourfront = "Fourfront"
const FoursightTitleCgap = "CGAP"
const FoursightTitleSmaht = "SMaHT"
const FoursightTitleUnknown = "Unknown"

// -------------------------------------------------------------------------------------------------
// Known environments related functions.
// -------------------------------------------------------------------------------------------------

function GetKnownEnvs(header) {
    return header?.auth?.known_envs || Cookie.KnownEnvs();
}

function IsKnownEnv(env, header) {
    if ((Str.HasValue(env) || Type.IsObject(env)) && Type.IsObject(header)) {
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
    return header?.auth?.default_env || Cookie.DefaultEnv();
}

function IsDefaultEnv(env, header) {
    return AreSameEnvs(GetDefaultEnv(header), env);
}

// -------------------------------------------------------------------------------------------------
// Allowed environments (authorization) related functions.
// -------------------------------------------------------------------------------------------------

function GetAllowedEnvs(header) {
    const allowedEnvs = header?.auth?.allowed_envs || Cookie.AllowedEnvs();
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
    if ((Str.HasValue(env) || Type.IsObject(env)) && Type.IsObject(header)) {
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
    if (Type.IsObject(envA)) {
        if (Type.IsObject(envB)) {
            return (envA?.name?.toLowerCase()           === envB?.name?.toLowerCase()) ||
                   (envA?.full_name?.toLowerCase()      === envB?.full_name?.toLowerCase()) ||
                   (envA?.short_name?.toLowerCase()     === envB?.short_name?.toLowerCase()) ||
                   (envA?.public_name?.toLowerCase()    === envB?.public_name?.toLowerCase()) ||
                   (envA?.foursight_name?.toLowerCase() === envB?.foursight_name?.toLowerCase());
        }
        else if (Str.HasValue(envB)) {
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
    else if (Str.HasValue(envA)) {
        if (Type.IsObject(envB)) {
            envA = envA.toLowerCase();
            return (envB?.name?.toLowerCase()           === envA) ||
                   (envB?.full_name?.toLowerCase()      === envA) ||
                   (envB?.short_name?.toLowerCase()     === envA) ||
                   (envB?.public_name?.toLowerCase()    === envA) ||
                   (envB?.foursight_name?.toLowerCase() === envA);
        }
        else if (Str.HasValue(envB)) {
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
    const currentPath = Path.Normalize(Context.Client.CurrentPath());
    const basePathWithTrailingSlash = Context.Client.BasePath() + "/";
    let env = "";
    if (currentPath.startsWith(basePathWithTrailingSlash)) {
        const pathSansBasePath = currentPath.substring(basePathWithTrailingSlash.length);
        if (pathSansBasePath.length > 0) {
            const slash = pathSansBasePath.indexOf("/");
            env = (slash >= 0) ? pathSansBasePath.substring(0, slash) : pathSansBasePath;
        }
    }
    if (Type.IsObject(header)) {
        if (!IsKnownEnv(env, header)) {
            env = GetDefaultEnv(header);
        }
    }
    return env;
}

function IsCurrentEnv(env) {
    return AreSameEnvs(GetCurrentEnv(), env);
}

// -------------------------------------------------------------------------------------------------
// Environment name variants related functions.
// -------------------------------------------------------------------------------------------------

function GetAnnotatedEnv(env, header) {
    if (Type.IsObject(env)) {
        return env;
    }
    else if (Str.HasValue(env)) {
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
    return (IsFoursightFourfront(header) || IsFoursightSmaht(header)) ? GetPublicEnvName(env, header) : GetFullEnvName(env, header);
}

// -------------------------------------------------------------------------------------------------
// Foursight-Fourfront vs. Foursight-CGAP and legacy Foursight related functions.
// -------------------------------------------------------------------------------------------------

function IsFoursightFlavor(header, flavor) {
    if (Cookie.TestMode.HasFoursightFlavor(flavor)) {
        return true;
    }
    const site = (header && !header?.loading) ? header?.app?.package : Cookie.Site();
    return site == `foursight-${flavor}` || site == flavor;
}

function IsFoursightFourfront(header) {
    return IsFoursightFlavor(header, "foursight");
}

function IsFoursightCgap(header) {
    return IsFoursightFlavor(header, "cgap");
}

function IsFoursightSmaht(header) {
    return IsFoursightFlavor(header, "smaht");
}

function GetFoursightGitHubBaseRepoName(header) {
    if (IsFoursightCgap(header)) {
        return "dbmi-bgm";
    }
    else if (IsFoursightFourfront(header)) {
        return "4dn-dcic";
    }
    else if (IsFoursightSmaht(header)) {
        return "smaht-dac";
    }
    else {
        return "unknown";
    }
}

function GetFoursightTitle(header) {
    if (IsFoursightCgap(header)) {
        return FoursightTitleCgap;
    }
    else if (IsFoursightFourfront(header)) {
        return FoursightTitleFourfront;
    }
    else if (IsFoursightSmaht(header)) {
        return FoursightTitleSmaht;
    }
    else {
        return FoursightTitleUnknown;
    }
}

function GetLegacyFoursightLink(header) {
    //
    // For Foursight-CGAP (as opposed to Foursight-Fourfront) going to just,
    // for example, /api/view/supertest, does not work, rather we want to
    // to, for example, /api/view/cgap-supertest. I.e. for Foursight-CGAP
    // use the full name and the public name for Foursight-Fourfront.
    //
    const env = ((IsFoursightFourfront(header) || IsFoursightSmaht(header)) ?
                  GetPublicEnvName(GetCurrentEnv(header), header) :
                  GetFullEnvName(GetCurrentEnv(header), header)) || GetDefaultEnv(header);
    if (Context.IsLocalCrossOrigin()) {
        return Context.Server.Origin() + "/api/view/" + env;
    }
    else {
        return "/api/view/" + env;
    }
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const exports = {
    AllowedEnvs:             GetAllowedEnvs,
    Current:                 GetCurrentEnv,
    Default:                 GetDefaultEnv,
    Equals:                  AreSameEnvs,
    FoursightName:           GetFoursightEnvName,
    FoursightTitle:          GetFoursightTitle,
    FoursightTitleCgap:      FoursightTitleCgap,
    FoursightTitleFourfront: FoursightTitleFourfront,
    FoursightTitleSmaht:     FoursightTitleSmaht,
    FoursightTitleUnknown:   FoursightTitleUnknown,
    FullName:                GetFullEnvName,
    FoursightGitHubBase:     GetFoursightGitHubBaseRepoName,
    IsAllowed:               IsAllowedEnv,
    IsCurrent:               IsCurrentEnv,
    IsDefault:               IsDefaultEnv,
    IsFoursightCgap:         IsFoursightCgap,
    IsFoursightFourfront:    IsFoursightFourfront,
    IsFoursightSmaht:        IsFoursightSmaht,
    IsKnown:                 IsKnownEnv,
    KnownEnvs:               GetKnownEnvs,
    LegacyFoursightLink:     GetLegacyFoursightLink,
    PreferredName:           GetPreferredEnvName,
    PublicName:              GetPublicEnvName,
    RegularName:             GetRegularEnvName,
    ShortName:               GetShortEnvName
}; export default exports;
