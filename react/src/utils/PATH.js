import STR from './STR';

function GetNormalizedPath(path) {
    if (!STR.HasValue(path)) {
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

export default {
    Normalize: GetNormalizedPath
}
