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

export const getEnvFromUrlPath = () => {
    const path = window.location.pathname.replace("/api/react/", "");
    const slash = path.indexOf("/")
    if (slash > 0) {
        return path.substring(0, slash)
    } else {
        return "";
    }
}

export const getBaseUrlPath = () => {
    return "/api/react/" + getEnvFromUrlPath()
}

export const URL = (path) => {
    return getBaseUrlPath() + path
}
