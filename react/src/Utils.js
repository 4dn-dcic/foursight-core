export const fetchData = (url, setData, setLoading) => {
    fetch(url).then(response => {
        return response.json();
    }).then(responseJson => {
        setData(responseJson);
        if (setLoading) {
            setLoading(false);
        }
    })
}

export const BASE_URL_PATH = "/api/react/";

export const getEnvFromUrlPath = () => {
    const path = window.location.pathname.replace(BASE_URL_PATH, "");
    const slash = path.indexOf("/");
    if (slash > 0) {
        return path.substring(0, slash);
    } else {
        return "";
    }
}

export const getLogicalPathFromUrlPath = () => {
    const path = window.location.pathname.replace(BASE_URL_PATH, "");
    const slash = path.indexOf("/");
    if (slash > 0) {
        return path.substring(slash);
    } else {
        return "";
    }
}

export const getBaseUrlPath = () => {
    return BASE_URL_PATH + getEnvFromUrlPath();
}

export const URL = (path) => {
    return getBaseUrlPath() + path;
}

export const URLE = (env) => {
    return BASE_URL_PATH + env + getLogicalPathFromUrlPath();
}
