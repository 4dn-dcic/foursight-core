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
