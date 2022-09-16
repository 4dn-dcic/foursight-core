// -------------------------------------------------------------------------------------------------
// Environment related functions.
// -------------------------------------------------------------------------------------------------

import STR from './STR';
import TYPE from './TYPE';

// Returns true iff the given two environments refer to same environment.
// The arguments may be either strings and/or JSON objects from the global
// header data element containing the annotated environment names, i.e. which
// contains these elements: name, full_name, short_name, public_name, foursight_name.
//
function AreSameEnvs(envA, envB) {
    if (TYPE.IsObject(envA)) {
        if (TYPE.IsObject(envB)) {
            return (envA?.name?.toLowerCase()           == envB?.name?.toLowerCase()) ||
                   (envA?.full_name?.toLowerCase()      == envB?.full_name?.toLowerCase()) ||
                   (envA?.short_name?.toLowerCase()     == envB?.short_name?.toLowerCase()) ||
                   (envA?.public_name?.toLowerCase()    == envB?.public_name?.toLowerCase()) ||
                   (envA?.foursight_name?.toLowerCase() == envB?.foursight_name?.toLowerCase());
        }
        else if (STR.HasValue(envB)) {
            envB = envB.toLowerCase();
            return (envA?.name?.toLowerCase()           == envB) ||
                   (envA?.full_name?.toLowerCase()      == envB) ||
                   (envA?.short_name?.toLowerCase()     == envB) ||
                   (envA?.public_name?.toLowerCase()    == envB) ||
                   (envA?.foursight_name?.toLowerCase() == envB);
        }
        else {
            return false;
        }
    }
    else if (STR.HasValue(envA)) {
        if (TYPE.IsObject(envB)) {
            envA = envA.toLowerCase();
            return (envB?.name?.toLowerCase()           == envA) ||
                   (envB?.full_name?.toLowerCase()      == envA) ||
                   (envB?.short_name?.toLowerCase()     == envA) ||
                   (envB?.public_name?.toLowerCase()    == envA) ||
                   (envB?.foursight_name?.toLowerCase() == envA);
        }
        else if (STR.HasValue(envB)) {
            return envA.toLowerCase() == envB.toLowerCase();
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
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    Equals: AreSameEnvs
}
