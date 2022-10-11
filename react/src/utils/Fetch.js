// -------------------------------------------------------------------------------------------------
// Fetch (HTTP GET et cetera) related functions.
// -------------------------------------------------------------------------------------------------

// N.B. In the process of moving from using the main fetchData function here
// to using the new useFetch React hook here. This will be cleaner and will
// also easily allow us to track (globally) all currently running fetches,
// for global spinner display purposes (useful for user and troubleshooting).

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

const DEFAULT_TIMEOUT = 30 * 1000;
const DEFAULT_DELAY = () => { const delay = Cookie.TestMode.FetchSleep(); return delay > 0 ? delay : 0; }
const MAX_SAVE = 100;

// The useFetch React hook.
// Used to define and/or initiaze an HTTP fetch to the server for some data.
// This will eventually supplant the fetchData function above.
//
// ARGUMENTS
//
// For convenience, arguments may be either an url string argument followed by an args
// object argument, OR just an args object argument which should contain the url string.
//
// Properties for the args are as follows:
//
// - url
//   URL (obviously) to fetch. If not a non-empty string then same as nofetch.
//
// - onData
//   Function to call when a successful data fetch is completed; it is called with the
//   fetched (JSON) data as an argument; this function should return that same passed data,
//   or some modified version of it, or whatever is desired, as the result of the fetch.
//
// - onDone
//   Function to call when the fetch is complete, whether or not the fetch was successful;
//   it is called with an object which is effectively the same as the response/state object
//   returned (as the first array item) from this hook, i.e. contain these properties:
//   data, loading, status, timeout, error; see the RETURN VALUE section below.
//
// - timeout
//   Number of milliiseconds to wait for the fetch to complete before
//   resulting in failure (an HTTP status code of 408 will be set on timeout).
//
// - nofetch
//   Boolean indicating, if true, that a fetch should actually not be done at all.
//   By default (and when this is false) the fetch is initiated immediately when this
//   hook is called. Useful when the fetch defined by this hook needs to be called later,
//   via the refresh function returned (as the second array item) from this hook; this same
//   refresh function (return value) can be used in any case to refresh/refetch the data.
//
// - nologout
//   Boolean indicating, if true, that the default behavior, of automatically logging out
//   the user if we get an unauthenticated (HTTP 401) response for the fetch, is disabled.
//
// - noredirect
//   Boolean indicating, if true, that the default behavior, of automatically redirecting the
//   user to the /env page if we get an unauthorized (HTTP 403) response for the fetch, is disabled.
//
// - delay
//   Number of milliseconds to delay the fetch.
//   To be used ONLY for testing purposes, i.e. to simulate slow fetches, and to make sure
//   things work well WRT that. Slow/delayed fetching can be globally enabled by (manuallly)
//   setting the test_mode_fetch_sleep cookie to some number of milliseconds to delay fetches by.
//
// RETURN VALUE
//
// The return value for this hook is a Reac-ish two-item array.
//
// The first item is the response/state of the fetch containing the following properties; these
// are the key values upon which the caller will normally rely to get all fetch related information.
//
// - data
//   JSON data fetched (optionally modified via onData arg/function), or null on error or timeout.
//
// - loading
//   Boolean indicating whether or not the fetch is in progress.
//
// - status
//   HTTP status code (e.g. 200).
//
// - timeout
//   Boolean indicating whether or not the fetch timed out.
//
// - error.
//   String containing the description of error which occurred, or null if no error.
//
// The second item is a refresh function which can be called to refresh, i.e. redo the fetch for,
// the data. Arguments to this refresh function are exactly like those for this useFetch hook function,
// and/but may also be individually overidden with different values, e.g. to refresh with a different URL.
// Unlike this onFetch hook, the refresh function returns no value.
//
// ADDITIONALLY
//
// All fetches executed via this hook will be tracked in global state which is available via these hooks:
//
// - useFetching
//   Hook returning the array of all currently executing fetches,
//   in the order of when the fetches were started.
//
// - useFetched
//   Hook returning the array of all the most recent completed fetches, up to some
//   maximum (MAX_SAVE) number, in the order of when the fetches were started.
//
export const useFetch = (url, args) => {

    const [ data, setData ] = useState(null);
    const [ loading, setLoading ] = useState(true);
    const [ status, setStatus ] = useState(0);
    const [ timeout, setTimeout ] = useState(false);
    const [ error, setError ] = useState(null);

    const fetching = _useFetching();
    const fetched = _useFetched();

    function assembleArgs(url, largs) {
        if (Type.IsObject(url)) {
            largs = url;
            url = null;
        }
        return {
            url:        Str.HasValue(url)                  ? url              : (Str.HasValue(largs?.url)          ? largs.url       : args?.url),
            onData:     Type.IsFunction(largs?.onData)     ? largs.onData     : (Type.IsFunction(args?.onData)     ? args.onData     : (data) => data),
            onDone:     Type.IsFunction(largs?.onDone)     ? largs.onDone     : (Type.IsFunction(args?.onDone)     ? args.onDone     : (response) => {}),
            timeout:    Type.IsInteger(largs?.timeout)     ? largs.timeout    : (Type.IsInteger(args?.timeout)     ? args.timeout    : DEFAULT_TIMEOUT),
            delay:      Type.IsInteger(largs?.delay)       ? largs.delay      : (Type.IsInteger(args?.delay)       ? args.delay      : DEFAULT_DELAY()),
            nologout:   Type.IsBoolean(largs?.nologout)    ? largs.nologout   : (Type.IsBoolean(args?.nologout)    ? args.nologout   : false),
            noredirect: Type.IsBoolean(largs?.noredirect)  ? largs.noredirect : (Type.IsBoolean(args?.noredirect)  ? args.noredirect : false),
            nofetch:    Type.IsBoolean(largs?.nofetch)     ? largs.nofetch    : (Type.IsBoolean(args?.nofetch)     ? args.nofetch    : false),
            setData:    setData,
            setLoading: setLoading,
            setStatus:  setStatus,
            setTimeout: setTimeout,
            setError:   setError,
            fetching:   fetching,
            fetched:    fetched
        };
    }

    args = assembleArgs(url, args);

    useEffect(() => {
        _doFetch(args);
    }, [])

    const response = { data: data, loading: loading, status: status, timeout: timeout, error: error };
    const refresh = (url, args) => { args = assembleArgs(url, args); args.nofetch = false; _doFetch(args); };

    return [ response, refresh ];
}

// Readonly hook to get the list of currently fetching.
// See ADDITIONALLY section in onFetch comments above.
//
export const useFetching = () => {
    return [ Array.from(useGlobal(_fetchingGlobal)[0].values()) ];
}

// Readonly hook to get the list of completed fetches.
// See ADDITIONALLY section in onFetch comments above.
//
export const useFetched = () => {
    return [ useGlobal(_fetchedGlobal)[0] ];
}

// -------------------------------------------------------------------------------------------------
// Internal use only.
// -------------------------------------------------------------------------------------------------

const _fetchingGlobal = defineGlobal(new Map());
const _fetchedGlobal  = defineGlobal([]);

const _useFetching = () => {
    const [ fetching, setFetching ] = useGlobal(_fetchingGlobal);
    const add = (fetch) => {
        const id = Uuid();
        fetch.id = id;
        fetch.timestamp = new Date();
        fetching.set(id, fetch);
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

const _useFetched = () => {
    const [ fetched, setFetched ] = useGlobal(_fetchedGlobal);
    const add = (fetch) => {
        fetch.duration = new Date() - fetch.timestamp;
        if (fetched.length >= MAX_SAVE) {
            //
            // Maximum number of save fetches reached;
            // remove the oldest (first) item.
            //
            fetched.shift();
        }
        fetched.push(fetch);
        setFetched(fetched);
    }
    const clear = () => {
        //
        // Not used yet.
        //
        fetched.length = 0;
        setFetched(fetched);
    }
    return { value: fetched, add: add, clear: clear }
}

// Internal _doFetch function to actualy do the fetch using axios.
// Assumes args have been validated and setup properly; must contain (exhaustively):
// url, setData, onData, onDone, setLoading, setStatus, setTimeout, setError, fetching, fetched, timeout, delay, nologout, noredirect
//
export const _doFetch = (args) => {

    function handleResponse(response, id) {
        console.log(`FETCH-HOOK-RESPONSE: ${args.url}`);
        const status = response.status;
        const data = response.data;
        args.setData(args.onData(data));
        args.setStatus(status);
        args.setLoading(false);
        noteFetchEnd(id);
        args.onDone({ data: data, loading: false, status: status, timeout: false, error: null });
    }

    function handleError(error, id) {
        console.log(`FETCH-HOOK-ERROR: ${args.url}`);
        let status = error.response?.status || 0;
        args.setData(null);
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
                status = 408;
                args.setStatus(status);
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
                status = 404;
                args.setStatus(status);
            }
        }
        else {
            args.setError(`Unknown HTTP error (code: ${error.code}).`);
        }
        noteFetchEnd(id);
        args.onDone({ data: null, loading: false, status: status, timeout: status == 408, error: error.message });
    }

    function noteFetchBegin(fetch) {
        return args.fetching.add(fetch);
    }

    function noteFetchEnd(id) {
        args.fetched.add(args.fetching.remove(id));
    }

    // Don't think we want to reset the data; leave
    // whatever was there until there is something new.
    // args.setData(null);

    args.setLoading(true);
    args.setStatus(0);
    args.setTimeout(false);
    args.setError(null);

    if (args.nofetch || !Str.HasValue(args.url)) {
        args.setLoading(false);
        args.onDone({ data: null, loading: false, status: 0, timeout: false, error: null });
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



// -------------------------------------------------------------------------------------------------
// LEGACY fetchData ... WILL BE SUPPLANTED BY useFetch HOOK ABOVE ...
// -------------------------------------------------------------------------------------------------

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

const exports = {
    get: fetchData
}; export default exports;
