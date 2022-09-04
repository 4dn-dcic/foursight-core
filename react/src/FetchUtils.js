import { GetCookie, GetAuthTokenCookie } from './CookieUtils';

function _sleep (time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

let _artificialSleepForTesting = GetCookie("test_mode_fetch_sleep");

// The Foursight API we call (foursight-core/foursight_core/react_api.py) is protected
// with a  new 'authToken' cookie which was created along with the 'jwtToken' cookie;
// We don't need to know this here but this authTokn is the jwtToken encrypted by the
// API (server-side) using a password it got from its GAC (namely S3_AWS_ACCESS_KEY_ID).
// We pass this authToken cookie value as an 'authorization' header to the API.
// The API decrypts this using its password (from the GAC) and checks that the
// decrypted value looks like a valid JWT token and that it's not expired, etc.
// I think this is reasonably secure.
//
// TODO
// Handle case of forbidden response from server and what ... logout ?
//
export const fetchData = (url, setData, setLoading, setError) => {
    if (_artificialSleepForTesting > 0) {
        console.log("FETCHING WITH " + _artificialSleepForTesting + "ms SLEEP: " + url);
    }
    else {
        console.log("FETCHING: " + url);
    }
    const headers = {
        // TODO: figure out why if this is not here exactly as 'authorization' running locally we get CORS preflight error.
        authorization: GetAuthTokenCookie() || "none"
    }
    return fetch(url, { headers: headers, mode: "cors" }).then(response => {
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
