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
const _fetching = new Map();
const _fetches = [];

export const _fetch = (url, setData, setLoading, setStatus, setTimeout, setError, setFetching, setFetches, options) => {

    function handleResponse(response, id) {
        const status = response.status;
        const data = response.data;
        setData(data);
        setStatus(status);
        setLoading(false);
        noteFetchEnd(id);
    }

    function handleError(error, id) {
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
            // though not necessarily a server timeout, so not strictly accurate;
            //
            if (!status) {
                setStatus(408);
            }
            setTimeout(true);
        }
        else if (error.code === "ERR_NETWORK") {
            //
            // When getting a CORS error (should not happen in real life rather just
            // local dev/testing and only things are not setup right) we do not get
            // an HTTP status code rather just and ERR_NETWORK eror in error.code.
            // though the Chrome debugger shows an HTTP 403.
            // https://github.com/axios/axios/issues/4420
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

    function noteFetchBegin(args) {
        const id = Uuid(); args.id = id;
        _fetching.set(id, args);
        if (setFetching) {
            setFetching(_fetching);
        }
        return id;
    }

    function noteFetchEnd(id) {
        const fetch = _fetching.get(id);
        _fetching.delete(id);
        _fetches.push(fetch);
        if (setFetching) {
            setFetching(_fetching);
        }
        if (setFetches) {
            setFetches(_fetches);
        }
    }

    if (!setData) setData = () => {}
    if (!setLoading) setLoading = () => {}
    if (!setStatus) setStatus = () => {}
    if (!setTimeout) setTimeout = () => {}
    if (!setError) setError = () => {}

    setData(null);
    setLoading(true);
    setStatus(0);
    setTimeout(false);
    setError(null);

    const method = "GET";
    const data = null;
    const timeout = options?.timeout > 0 ? options?.timeout : _DEFAULT_FETCH_TIMEOUT;
    const delay = options?.delay > 0 ? options?.delay : (Cookie.TestMode.HasFetchSleep() ? Cookie.TestMode.FetchSleep() : 0);
    const fetch = { url: url, method: method, data: data, timeout: timeout };

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

export const Fetching = defineGlobal(_fetching);
export const Fetches  = defineGlobal(_fetches);

export const useFetch = (url, options = { timeout: _DEFAULT_FETCH_TIMEOUT } ) => {

    const [ data, setData ] = useState();
    const [ loading, setLoading ] = useState();
    const [ status, setStatus ] = useState();
    const [ timeout, setTimeout ] = useState();
    const [ error, setError ] = useState();
    const [ fetching, setFetching ] = useGlobal(Fetching);
    const [ fetches, setFetches ] = useGlobal(Fetches);

    useEffect(() => {
        _fetch(url, setData, setLoading, setStatus, setTimeout, setError, setFetching, setFetches, { ...options });
    }, [url])

    return [ { data: data, loading: loading, status: status, timeout: timeout, error: error },
             () => _fetch(url, setData, setLoading, setStatus, setTimeout, setError, setFetching, setFetches, { ...options }) ];
}

export const useFetchFunction = (url, options = { timeout: _DEFAULT_FETCH_TIMEOUT } ) => {

    const [ data, setData ] = useState();
    const [ loading, setLoading ] = useState();
    const [ status, setStatus ] = useState();
    const [ timeout, setTimeout ] = useState();
    const [ error, setError ] = useState();
    const [ fetching, setFetching ] = useGlobal(Fetching);
    const [ fetches, setFetches ] = useGlobal(Fetches);

    return [ { data: data, loading: loading, status: status, timeout: timeout, error: error },
             () => _fetch(url, setData, setLoading, setStatus, setTimeout, setError, setFetching, setFetches, { ...options }) ];
}

const exports = {
    get: fetchData
}; export default exports;
