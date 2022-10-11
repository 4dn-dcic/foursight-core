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
import Type from '../utils/Type';
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

const _MAX_FETCHES_SAVED = 200;

function default_timeout() {
    return 30 * 1000;
}

function default_delay() {
    const delay = Cookie.TestMode.FetchSleep();
    return (delay > 0 ? delay : 0);
}

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

// Internal use only fetch function.
// Assumed args have been validated and setup properly; they must contain (exhaustively):
// url, setData, setLoading, setStatus, setTimeout, setError, fetching, fetches, timeout, delay, nologout, noredirect
//
export const _fetch = (args) => {

    function handleResponse(response, id) {
        console.log(`FETCH-HOOK-RESPONSE: ${args.url}`);
        const status = response.status;
        const data = response.data;
        args.setData(data);
        args.setStatus(status);
        args.setLoading(false);
        noteFetchEnd(id);
    }

    function handleError(error, id) {
        console.log(`FETCH-HOOK-ERROR: ${args.url}`);
        let status = error.response?.status || 0;
        args.setStatus(status);
        args.setError(error.message);
        args.setLoading(false);
        if (status === 401) {
            //
            // If we EVER get an HTTP 401 (not authenticated)
            // then we just logout the user.
            //
            if (!args.nologout) {
                Logout();
            }
        }
        else if (status === 403) {
            //
            // If we EVER get an HTTP 403 (not authorized)
            // then redirect to th the /env page.
            //
            if (!args.noredirect) {
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
                args.setStatus(408);
            }
            args.setTimeout(true);
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
                args.setStatus(404);
            }
        }
        else {
            args.setError(`Unknown HTTP error (code: ${error.code}).`);
        }
        noteFetchEnd(id);
    }

    function noteFetchBegin(fetch) {
        return args.fetching.add(fetch);
    }

    function noteFetchEnd(id) {
        args.fetches.add(args.fetching.remove(id));
    }

 // args.setData(null);  // TODO: Not sure we want to reset this.
    args.setLoading(true);
    args.setStatus(0);
    args.setTimeout(false);
    args.setError(null);

    if (args.nofetch || !Str.HasValue(args.url)) {
        args.setLoading(false);
        return;
    }

    const method = "GET";
    const data = null;
    const fetch = { url: args.url, method: method, data: data, withCredentials: "include", timeout: args.timeout };

    console.log(`FETCH-HOOK: ${args.url}`);

    const id = noteFetchBegin(fetch);
    axios(fetch)
        .then(response => {
            if (args.delay > 0) {
                window.setTimeout(() => handleResponse(response, id), args.delay);
            }
            else {
                handleResponse(response, id);
            }
        })
        .catch(error => {
            if (args.delay > 0) {
                window.setTimeout(() => handleError(error, id), args.delay);
            }
            else {
                handleError(error, id);
            }
        });
}

// The main useFetch hook.
// Arguments may be either an url string argument followed an args object argument OR
// just an args object arguent which should contain the url string argument.
//
export const useFetch = (url, args) => {

    const [ data, setData ] = useState(null);
    const [ loading, setLoading ] = useState(true);
    const [ status, setStatus ] = useState(0);
    const [ timeout, setTimeout ] = useState(false);
    const [ error, setError ] = useState(null);

    const fetching = _useFetching();
    const fetches = _useFetches();

    function assembleArgs(url, largs) {
        if (Type.IsObject(url)) {
            largs = url;
            url = null;
        }
        return {
            url:        Str.HasValue(url)                  ? url              : (Str.HasValue(largs?.url)          ? largs.url       : args?.url),
            setData:    Type.IsFunction(largs?.setData)    ? largs.setData    : (Type.IsFunction(args?.setData)    ? args.setData    : setData),
            setLoading: Type.IsFunction(largs?.setLoading) ? largs.setLoading : (Type.IsFunction(args?.setLoading) ? args.setLoading : setLoading),
            setStatus:  Type.IsFunction(largs?.setStatus)  ? largs.setStatus  : (Type.IsFunction(args?.setStatus)  ? args.setStatus  : setStatus),
            setTimeout: Type.IsFunction(largs?.setTimeout) ? largs.setTimeout : (Type.IsFunction(args?.setTimeout) ? args.setTimeout : setTimeout),
            setError:   Type.IsFunction(largs?.setError)   ? largs.setError   : (Type.IsFunction(args?.setError)   ? args.setError   : setError),
            timeout:    Type.IsInteger(largs?.timeout)     ? largs.timeout    : (Type.IsInteger(args?.timeout)     ? args.timeout    : default_timeout()),
            delay:      Type.IsInteger(largs?.delay)       ? largs.delay      : (Type.IsInteger(args?.delay)       ? args.delay      : default_delay()),
            nologout:   Type.IsBoolean(largs?.nologout)    ? largs.nologout   : (Type.IsBoolean(args?.nologout)    ? args.nologout   : false),
            noredirect: Type.IsBoolean(largs?.noredirect)  ? largs.noredirect : (Type.IsBoolean(args?.noredirect)  ? args.noredirect : false),
            nofetch:    Type.IsBoolean(largs?.nofetch)     ? largs.nofetch    : (Type.IsBoolean(args?.nofetch)     ? args.nofetch    : false),
            fetching:   fetching,
            fetches:    fetches
        };
    }

    args = assembleArgs(url, args);

    useEffect(() => {
        _fetch(args);
    }, [])

    return [
        { data: data, loading: loading, status: status, timeout: timeout, error: error },
        (url, args) => { args = assembleArgs(url, args); args.nofetch = false; _fetch(args); }
    ];
}

const exports = {
    get: fetchData
}; export default exports;
