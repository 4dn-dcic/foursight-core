// -------------------------------------------------------------------------------------------------
// Path related function.
// -------------------------------------------------------------------------------------------------

import Str from './Str';

function GetNormalizedPath(path) {
    if (!Str.HasValue(path)) {
        return "";
    }
    path = path.replace(/\/+/g, "/");
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1)
    }
    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    return path;
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    Normalize: GetNormalizedPath
};
export default Exports;
