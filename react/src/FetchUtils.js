import { GetCookie } from './CookieUtils.js';

function _sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

let _artificialSleepForTesting = GetCookie("test_mode_fetch_sleep");

export const fetchData = (url, setData, setLoading, setError) => {
    if (_artificialSleepForTesting > 0) {
        console.log("FETCHING WITH " + _artificialSleepForTesting + "ms SLEEP: " + url);
    }
    else {
        console.log("FETCHING: " + url);
    }
    fetch(url).then(response => {
        console.log("FETCH STATUS CODE IS " + response.status + ": " + url);
        if (response.status == 200) {
            response.json().then(responseJson => {
                if (_artificialSleepForTesting > 0) {
                    _sleep(_artificialSleepForTesting).then(() => {
                        console.log("FETCHING DONE WITH " + _artificialSleepForTesting + "ms SLEEP: " + url);
                        setData(responseJson)
                        if (setLoading) {
                            setLoading(false);
                        }
                    });
                }
                else {
                    console.log("FETCHING SET DATA DONE: " + url);
                    setData(responseJson);
                    if (setLoading) {
                        setLoading(false);
                    }
                }
            }).catch(error => {
                console.log("FETCH JSON ERROR: " + url);
                console.log(error);
                if (setError) {
                    setError(error);
                }
            });
        }
        else {
            if (setError) {
                setError(response.status);
            }
        }
    }).catch(error => {
        console.log("FETCH ERROR: " + url);
        console.log(error);
        if (setError) {
            setError(error);
        }
    });
}
