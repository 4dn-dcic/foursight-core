// -------------------------------------------------------------------------------------------------
// Fetch (HTTP GET et cetera) related functions.
// -------------------------------------------------------------------------------------------------

import Client from '../utils/Client';
import COOKIE from '../utils/COOKIE';
import LOGOUT from '../utils/LOGOUT';

function SLEEP(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// The Foursight API we call (foursight-core/foursight_core/react_api.py) is protected
// with a  new 'authtoken' cookie which was created along with the 'jwtToken' cookie;
// We don't need to know this here but this authTokn is the jwtToken encrypted by the
// API (server-side) using a password it got from its GAC (namely S3_AWS_ACCESS_KEY_ID).
// This authtoken cookie get automatically passed React API. The React API decrypts
// this using its password (from the GAC) and checks that the decrypted value looks
// like a valid JWT token and that it's not expired, etc.
// See: https://hms-dbmi.atlassian.net/wiki/spaces/~627943f598eae500689dbdc7/pages/2882699270/Foursight+React#Authentication-%26-Authorization
//
// TODO: Handle timeouts!
// TODO: Handle 403 forbidden specifically indicating that the (JWT within the) authtoken has expired.
//
function fetchData(url, setData, setLoading, setError) {
    if (COOKIE.TestMode.HasFetchSleep()) {
        console.log("FETCHING WITH " + COOKIE.TestMode.FetchSleep() + "ms SLEEP: " + url);
    }
    else {
        console.log("FETCHING: " + url);
    }
    const headers = {}
    return fetch(url, { headers: headers, credentials:"include"}).then(response => {
        console.log("FETCH STATUS CODE IS " + response.status + ": " + url);
        if (response.status === 200) {
            response.json().then(responseJson => {
                if (COOKIE.TestMode.HasFetchSleep()) {
                    SLEEP(COOKIE.TestMode.FetchSleep()).then(() => {
                        console.log("FETCHING DONE WITH " + COOKIE.TestMode.FetchSleep() + "ms SLEEP: " + url);
                        setData(responseJson)
                        if (setLoading) {
                            setLoading(false);
                        }
                        return true;
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
            console.log(response);
            if (response.status === 403) {
                console.log("FETCH IS FORBIDDEN! " + url);
                console.log(window.location);
                // window.location.pathname = "/api/react/cgap-supertest/forbidden";
                // window.location.pathname = Client.Path("/forbidden");
                LOGOUT();
            }
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

// -------------------------------------------------------------------------------------------------
// Exported functions.
// -------------------------------------------------------------------------------------------------

export default {
    get: fetchData
}
