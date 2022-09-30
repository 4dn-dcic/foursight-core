// -------------------------------------------------------------------------------------------------
// JWT related functions.
// -------------------------------------------------------------------------------------------------

import { Buffer } from 'buffer';

// Decodes the given JWT (presumably the authtoken cookie). This does NOT do signature verification,
// as we can't because we are the client and we don't have the secret, and we don't need/want to
// anyways; we just want the data, which is visible. The server (React API) does signature
// validation on authentication/authorization, on every (protected) API call.
//
function DecodeJwt(jwt) {
    //
    // FYI this generally takes (on my/dmichaels MacBook using Chrome) less than 0.2ms.
    // Adapted from: https://stackoverflow.com/questions/52863051/decode-jwt-token-in-node-without-library
    // const base64Url = token.split('.')[1];
    // const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    // const buff = new Buffer(base64, 'base64');
    // const payloadinit = buff.toString('ascii');
    // const payload = JSON.parse(payloadinit);
    //
    try {
        return JSON.parse(Buffer(jwt.split('.')[1], "base64").toString());
    }
    catch {
        return {error: "Cannot decode JWT!" }
    }
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    Decode: DecodeJwt
};
export default Exports;
