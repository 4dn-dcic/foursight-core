export const fetchData = (url, setData, setLoading) => {
    console.log("FETCHING: " + url);
    fetch(url).then(response => {
        return response.json();
        console.log("FETCHING DONE: " + url);
    }).then(responseJson => {
        console.log("FETCHING SET DATA: " + url);
        setData(responseJson);
        if (setLoading) {
            setLoading(false);
        }
    })
}
