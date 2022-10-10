// -------------------------------------------------------------------------------------------------
// Fetch (HTTP GET et cetera) related functions.
// -------------------------------------------------------------------------------------------------

import axios from 'axios';
import { useEffect, useState } from 'react';
import { defineGlobal, useGlobal } from '../Global';
import Client from '../utils/Client';
import Cookie from '../utils/Cookie';
import Context from '../utils/Context';
import Global from '../Global';
import Logout from '../utils/Logout';
import Str from '../utils/Str';
import Uuid from '../utils/Uuid';

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

const _DEFAULT_FETCH_TIMEOUT = 30000;
const _MAX_FETCHES_SAVED = 200;

// We maintain a lists of currently fetching and
// completed fetches for troubleshooting and general FYI.

const _fetchingGlobal = defineGlobal(new Map());
const _fetchesGlobal  = defineGlobal([]);

// Internal use only hook to maintain the list of curently fetching.
//
const _useFetching = () => {
    const [ fetching, setFetching ] = useGlobal(_fetchingGlobal);
    const add = (fetch) => {
        const id = Uuid();
        fetch.id = id;
        fetch.timestamp = new Date();
        fetching.set(id, fetch);
        //
        // TODO
        // Maintain a maximum of _MAX_FETCHES_SAVED fetches.
        //
        setFetching(fetching); return id;
    }
    const remove = (id) => {
        const fetch = fetching.get(id);
        fetching.delete(id);
        setFetching(fetching);
        return fetch;
    }
    const clear = () => {
        fetching.clear();
        setFetching(fetching);
    }
    return { value: fetching, add: add, remove: remove, clear: clear };
}

// Internal use only hook to maintain the list of completed fetches.
//
const _useFetches = () => {
    const [ fetches, setFetches ] = useGlobal(_fetchesGlobal);
    const add = (fetch) => {
        delete fetch.data;
        fetch.duration = new Date() - fetch.timestamp;
        fetches.push(fetch);
        setFetches(fetches);
    }
    const clear = () => {
        //
        // Not used yet.
        //
        fetches.length = 0;
        setFetches(fetches);
    }
    return { value: fetches, add: add, clear: clear }
}

// Readonly hook to get the list of currently fetching.
//
export const useFetching = () => {
    return [ Array.from(useGlobal(_fetchingGlobal)[0].values()) ];
}

// Readonly hook to get the list of completed fetches.
//
export const useFetches = () => {
    return [ useGlobal(_fetchesGlobal)[0] ];
}

// Internal fetch function.
//
export const _fetch = (url, setData, setLoading, setStatus, setTimeout, setError, fetching, fetches, options) => {

    function handleResponse(response, id) {
        console.log(`FETCH-HOOK-RESPONSE: ${url}`);
        const status = response.status;
        const data = response.data;
        setData(data);
        setStatus(status);
        setLoading(false);
        noteFetchEnd(id);
    }

    function handleError(error, id) {
        console.log(`FETCH-HOOK-ERROR: ${url}`);
        let status = error.response?.status || 0;
        setStatus(status);
        setError(error.message);
        setLoading(false);
        if (status === 401) {
            //
            // If we EVER get an HTTP 401 (not authenticated)
            // then we just logout the user.
            //
            if (options?.nologout !== true) {
                Logout();
            }
        }
        else if (status === 403) {
            //
            // If we EVER get an HTTP 403 (not authorized)
            // then redirect to th the /env page.
            //
            if (options?.noredirect !== true) {
                if (Client.CurrentLogicalPath() !== "/env") {
                    window.location.pathname = Client.Path("/env");
                }
            }
        }
        else if (error.code === "ECONNABORTED") {
            //
            // This is what we get on timeout; no status code; set status to 408,
            // though not necessarily a server timeout, so not strictly accurate.
            //
            if (!status) {
                setStatus(408);
            }
            setTimeout(true);
        }
        else if (error.code === "ERR_NETWORK") {
            //
            // When getting a CORS error (should not happen in real life, rather just
            // in local dev/testing, and only when things are not setup right) we do
            // not get an HTTP status code but rather just an ERR_NETWORK error in
            // error.code; though the Chrome debugger shows an HTTP 403.
            // See: https://github.com/axios/axios/issues/4420
            //
            if (!status) {
                setStatus(404);
            }
        }
        else {
            setError(`Unknown HTTP error (code: ${error.code}).`);
        }
        noteFetchEnd(id);
    }

    function noteFetchBegin(fetch) {
        return fetching.add(fetch);
    }

    function noteFetchEnd(id) {
        fetches.add(fetching.remove(id));
    }

    // setData(null);
    // setLoading(true);
    // setStatus(0);
    // setTimeout(false);
    // setError(null);

    const method = "GET";
    const data = null;
    const timeout = options?.timeout > 0 ? options.timeout : _DEFAULT_FETCH_TIMEOUT;
    const delay = options?.delay > 0 ? options.delay : (Cookie.TestMode.HasFetchSleep() ? Cookie.TestMode.FetchSleep() : 0);
    const fetch = { url: url, method: method, data: data, withCredentials: "include", timeout: timeout };

    console.log(`FETCH-HOOK: ${url}`);
    const id = noteFetchBegin(fetch);
    axios(fetch)
        .then(response => {
            if (delay > 0) {
                window.setTimeout(() => handleResponse(response, id), delay);
            }
            else {
                handleResponse(response, id);
            }
        })
        .catch(error => {
            if (delay > 0) {
                window.setTimeout(() => handleError(error, id), delay);
            }
            else {
                handleError(error, id);
            }
        });
}

export const useFetch = (url, fetch = true, options = { timeout: _DEFAULT_FETCH_TIMEOUT } ) => {

    const [ data, setData ] = useState(null);
    const [ loading, setLoading ] = useState(true);
    const [ status, setStatus ] = useState(0);
    const [ timeout, setTimeout ] = useState(false);
    const [ error, setError ] = useState(null);

    const fetching = _useFetching();
    const fetches = _useFetches();

    const request = (update) => _fetch(url, update || setData, setLoading, setStatus, setTimeout, setError, fetching, fetches, { ...options });
    const response = { data: data, loading: loading, status: status, timeout: timeout, error: error };

    useEffect(() => {
        if (fetch && Str.HasValue(url)) {
            request();
        }
    }, [])

    return [ response, request ];
}

const exports = {
    get: fetchData
}; export default exports;
