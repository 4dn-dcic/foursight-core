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

function GetPathFromUrl(url) {
    if (url.startsWith("http://")) {
        const path = url.substring(7);
        const slash = path.indexOf("/");
        return (slash >= 0) ? GetNormalizedPath(path.substring(slash)) : "/";
    }
    else if (url.startsWith("https://")) {
        const path = url.substring(8);
        const slash = path.indexOf("/");
        return (slash >= 0) ? GetNormalizedPath(path.substring(slash)) : "/";
    }
    else {
        return url;
    }
}

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

const Exports = {
    Normalize: GetNormalizedPath,
    FromUrl: GetPathFromUrl
};
export default Exports;
