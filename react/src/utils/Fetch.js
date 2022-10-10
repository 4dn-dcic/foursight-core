// -------------------------------------------------------------------------------------------------
// Fetch (HTTP GET et cetera) related functions.
// -------------------------------------------------------------------------------------------------

import axios from 'axios';
import { useEffect, useState } from 'react';
import Client from '../utils/Client';
import Cookie from '../utils/Cookie';
import Context from '../utils/Context';
import Logout from '../utils/Logout';

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
//
function fetchData(url, setData, setLoading, setError) {
    if (Cookie.TestMode.HasFetchSleep()) {
        console.log("FETCHING WITH " + Cookie.TestMode.FetchSleep() + "ms SLEEP: " + url);
    }
    else {
        console.log("FETCHING: " + url);
    }
    const args = Context.IsLocalCrossOrigin() ? { credentials: "include" } : {};
    return fetch(url, args).then(response => {
        console.log("FETCH STATUS CODE IS " + response.status + ": " + url);
        if (response.status === 200) {
            response.json().then(responseJson => {
                if (Cookie.TestMode.HasFetchSleep()) {
                    SLEEP(Cookie.TestMode.FetchSleep()).then(() => {
                        console.log("FETCHING DONE WITH " + Cookie.TestMode.FetchSleep() + "ms SLEEP: " + url);
                        if (setData) {
                            setData(responseJson)
                        }
                        if (setLoading) {
                            setLoading(false);
                        }
                        return true;
                    });
                }
                else {
                    console.log("FETCHING SET DATA DONE: " + url);
                    if (setData) {
                        setData(responseJson);
                    }
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
            if (response.status === 401) {
                //
                // TODO
                // Perhaps somewhat questionable behavior.
                // If we EVER get an HTTP 401 then we just logout the user.
                //
                console.log("FETCH IS UNAUTHENTICATED! " + url);
                Logout();
            }
            else if (response.status === 403) {
                console.log("FETCH IS UNAUTHORIZED! " + url);
                if (Client.CurrentLogicalPath() !== "/env") {
                    window.location.pathname = Client.Path("/env");
                }
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

const DEFAULT_FETCH_TIMEOUT = 1000; // 10 * 1000;

// export const doFetch = (url, response, timeout = DEFAULT_FETCH_TIMEOUT) => {
// }

function _fetch(url, setData, setLoading, setStatus, setTimeout, setError, timeout) {

    timeout = timeout > 0 ? timeout : DEFAULT_FETCH_TIMEOUT;
    const delay = 0;

    function handleResponse(response) {
        const status = response.status;
        const data = response.data;
        setData(data);
        setStatus(status);
        setLoading(false);
    }

    function handleError(error) {
        let status = error.response?.status || 0;
        setError(error.message);
        setStatus(status);
        setLoading(false);
        if (status === 401) {
            //
            // If we EVER get an HTTP 401 (not authenticated)
            // then we just logout the user.
            //
            // Logout();
        }
        else if (status === 403) {
            //
            // If we EVER get an HTTP 403 (not authorized)
            // then redirect to th the /env page.
            //
            if (Client.CurrentLogicalPath() !== "/env") {
                window.location.pathname = Client.Path("/env");
            }
        }
        else {
            const code = error.code;
            if (error.code === "ECONNABORTED") {
                if (!status) {
                    setStatus(408);
                }
                setTimeout(true);
            }
            else if (error.code === "ERR_NETWORK") {
                //
                // FYI when getting a CORS error (should not happen in real life rather
                // just local dev/testing and only things are not setup right) we do not
                // get an HTTP status code rather just and ERR_NETWORK eror in error.code.
                // though the Chrome debugger shows an HTTP 403.
                // https://github.com/axios/axios/issues/4420
                //
                if (!status) {
                    setStatus(403);
                }
            }
            else {
                setError(`Unknown HTTP error (code: ${error.code}).`);
            }
        }
    }

    setData(null);
    setLoading(true);
    setTimeout(false);
    setError(null);
    setStatus(0);

    const method = "GET";
    const data = null;

    axios({ url: url, method: method, data: data, timeout: timeout })
        .then(response => {
            if (delay > 0) {
                setTimeout(() => handleResponse(response), delay);
            }
            else {
                handleResponse(response);
            }
        })
        .catch(error => {
            if (delay > 0) {
                setTimeout(() => handleError(error), delay);
            }
            else {
                handleError(error);
            }
        });
}

export const useFetch = (url, options = { timeout: DEFAULT_FETCH_TIMEOUT } ) => {

    const [ data, setData ] = useState();
    const [ loading, setLoading ] = useState();
    const [ status, setStatus ] = useState();
    const [ timeout, setTimeout ] = useState();
    const [ error, setError ] = useState();
    const delay = 0;

    useEffect(() => {
        _fetch(url, setData, setLoading, setStatus, setTimeout, setError, options?.timeout);
    }, [url])

    return { data: data, loading: loading,  status: status, timeout: timeout, error: error };
}

const exports = {
    get: fetchData
}; export default exports;
