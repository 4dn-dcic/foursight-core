import COOKIE from '../utils/COOKIE';

function _sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

let _artificialSleepForTesting = COOKIE.Get("test_mode_fetch_sleep");

// The Foursight API we call (foursight-core/foursight_core/react_api.py) is protected
// with a  new 'authtoken' cookie which was created along with the 'jwtToken' cookie;
// We don't need to know this here but this authTokn is the jwtToken encrypted by the
// API (server-side) using a password it got from its GAC (namely S3_AWS_ACCESS_KEY_ID).
// This authtoken cookie get automatically passed React API. The React API decrypts
// this using its password (from the GAC) and checks that the decrypted value looks
// like a valid JWT token and that it's not expired, etc.
// See: https://hms-dbmi.atlassian.net/wiki/spaces/~627943f598eae500689dbdc7/pages/2882699270/Foursight+React#Authentication-%26-Authorization
//
// TODO: Handle case of forbidden response from server and what ... logout ?
// TODO: Handle timeouts!
//
export const fetchData = (url, setData, setLoading, setError) => {
    if (_artificialSleepForTesting > 0) {
        console.log("FETCHING WITH " + _artificialSleepForTesting + "ms SLEEP: " + url);
    }
    else {
        console.log("FETCHING: " + url);
    }
    const headers = {}
    return fetch(url, { headers: headers, credentials:"include"}).then(response => {
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
            console.log("FETCH STATUS CODE IS NOT 200 BUT " + response.status + ": " + url);
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
