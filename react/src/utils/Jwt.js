// -------------------------------------------------------------------------------------------------
// JWT related functions.
// -------------------------------------------------------------------------------------------------

import { Buffer } from "buffer";

function DecodeJwt(jwt) {
    //
    // FYI this generally takes (on my/dmichaels MacBook using Chrome) less than 0.2ms.
    // Adapted from: https://stackoverflow.com/questions/52863051/decode-jwt-token-in-node-without-library
    //
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
