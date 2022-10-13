// -------------------------------------------------------------------------------------------------
// HTTP fetch related hooks: useFetch, useFetchFunction, useFetching, useFetched
// -------------------------------------------------------------------------------------------------

import axios from 'axios';
import { useEffect, useState } from 'react';
import uuid from 'react-uuid';
import { defineGlobal, useGlobal } from '../Global';
import Client from '../utils/Client';
import Cookie from '../utils/Cookie';
import Debug from '../utils/Debug';
import Logout from '../utils/Logout';
import Str from '../utils/Str';
import Type from '../utils/Type';

const DEFAULT_TIMEOUT = 30 * 1000;
const DEFAULT_DELAY = () => { return TEST_MODE_DELAY > 0 ? TEST_MODE_DELAY : 0; };
const TEST_MODE_DELAY = Cookie.TestMode.FetchSleep();
const MAX_SAVE = 25;

// This useFetch React hook is used to centrally facilitate all App HTTP fetches.
// Used to define or initiate HTTP fetches, and update or refresh the fetched data.
// Takes an URL and various arguments (see below) and returns state (see below) wrapping
// up pertinent info (data, loading, status, timeout, error) as well as a data update and
// refresh function. Also globally tracks all outstanding (in progress) fetches (e.g. useful
// for a global fetching spinnner), as well as all completed fetches (not yet used).
//
// ARGUMENTS
//
// For convenience, arguments may be either an url string argument followed by an args
// object argument, OR just an args object argument which should contain the URL string.
//
// Properties for the args are as follows:
//
// - url
//   URL (obviously) to fetch. If not a non-empty string then same as nofetch.
//
// - timeout
//   Number of milliiseconds to wait for the fetch to complete before
//   resulting in failure (an HTTP status code of 408 will be set on timeout).
//
// - nofetch
//   Boolean indicating, if true, that a fetch should actually not be done at all.
//   By default (and when this is false) the fetch is initiated immediately when this
//   hook is called. Useful when the fetch defined by this hook needs to be called later,
//   via the refresh function returned from this hook (see the RETURN VALUE section below).
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
// - onData
//   Function to call when a SUCCESSFUL data fetch is completed; it is called with the
//   fetched (JSON) data as an argument; this function should return that same passed data,
//   OR some modified version of it, OR whatever is desired; this returned value will be
//   set as the result the fetch; if nothing at all is returned (i.e. undefined) then the
//   fetched data will implicitly be used (if null is desired, then return null explicitly).
//
//   Iff the invocation of the fetch which triggered this callback was via the refresh
//   function (see the RETURN VALUE section below) then a second argument is passed to
//   this callback which is the previously (or rather current, at this point) fetched data.
//
// - onDone
//   Function to call when the fetch is complete, whether or not the fetch was successful;
//   it is called with an object which is effectively the same as the response/state object
//   returned from this hook, i.e. containing these properties: data, loading, status,
//   timeout, error; see the RETURN VALUE section below. If the fetch is unsuccessful,
//   i.e.  timeout or error, then data is null.
//
// - onError
//   Same as onDone but call ONLY on error (or timeout).
//
// RETURN VALUE
//
// The return value for this hook is an object containing the state of the fetch,
// including whether or not it the fetch is in progress, whether or not the fetch
// was successful, and the fetched data itself on fetch completion; it also contains
// functions to set, update, and/or refresh the fetched data. Details below on the
// properties of this returned object; these are the key values upon which the caller
// will normally rely to get all fetch related information (and to update the data).
//
// - data
//   JSON data fetched (optionally modified via onData arg/function),
//   or null on error or timeout.
//
// - loading
//   Boolean indicating whether or not the fetch is in progress.
//
// - status
//   Integer HTTP status code (e.g. 200).
//
// - timeout
//   Boolean indicating whether or not the fetch timed out.
//
// - error
//   String containing a short description of any error which occurred; null if no error.
//
// - update
//   Function to dynamically update the data state. This will do a proper deep update of the data,
//   which is usually what is desired. Any data may be passed as an argument to this update function.
//   Or, if no argument is passed, it will use the data associated with the useFetch response
//   object through which this update was called.
//
// - set
//   Function to dynamically update the data state. This uses the vanilla React useState
//   setter function associated with the data, which does NOT automatically do a deep update
//   of the data, e.g. if the data is an object and only a property of it has been changed.
//   This behavior is a common source of confusion; is often not what is expecte or desired;
//   use the update function (above) to force the data state to fully update.
//
// - refresh
//   Function to dynamically refresh, i.e. redo the fetch for, the data. Arguments to this
//   are exactly like those for this useFetch hook function, AND may be used to INDIVIDUALLY
//   overide the useFetch arguments with different values, e.g. to refresh with a different URL.
//   This refresh function returns the exact same return value as the useFetch call.
//
//   Note that this refresh function will update the same state variables (data, loading, status, timeout,
//   error) returned by that inital useFetch call. So this is not meant for multiple independent fetches;
//   use multiple useFetch instantiations for that. The main use of this is to do simple refreshes of an
//   initial fetch, and also (when using the nofetch argument) to obtain a fetch function for later use.
//
// ADDITIONALLY
//
// All fetches executed via this hook will be tracked in global state which is available via these hooks:
//
// - useFetching
//   Hook returning the array of all currently executing fetches, in the order of when the
//   fetches were started. Useful for troubleshooting and for the end user, e.g. to display
//   a spinner/whatever indicating the existence and count of outstanding fetches.
//
// - useFetched
//   Hook returning the array of all the most recent completed fetches, up to some
//   maximum (MAX_SAVE) number (the most recent are saved), in the order of when
//   the fetches were started. May be useful for troubleshooting but not yet used.
//
// LIMITATIONS
//
// Currently just for HTTP GET. Will add support for other verbs as/when necessary.
//
// OTHER COMMENTS
//
// Looking back over this, this does look rather complex, but be assured the goal was to make
// the USAGE simple; to be able to fetch and update data with as little detailed logic and friction
// as possible; and to be able to globally track outstanding fetching, to have a global fetching
// spinner, which will obviate the need to have these on individual pages which would otherwise
// complicate the logic there. This grew organically over time; time will tell if we've achieved
// the desired simplicity of use. And note that the usage of the latest iteration of this has
// not yet been fully taken advantage of in the calling components; still TODO.

export const useFetch = (url, args) => {

    const [ data, setData ] = useState(null);
    const [ loading, setLoading ] = useState(true);
    const [ status, setStatus ] = useState(0);
    const [ timeout, setTimeout ] = useState(false);
    const [ error, setError ] = useState(null);

    const fetching = _useFetching();
    const fetched = _useFetched();

    function assembleArgs(urlOverride = null, argsOverride = null, nonofetch = false) {
        return _assembleFetchArgs(url, args, urlOverride, argsOverride,
                                  setData, setLoading, setStatus, setTimeout, setError,
                                  fetching, fetched, nonofetch);
    }

    useEffect(() => {
        _doFetch(assembleArgs());
    }, [])

    const update = function(data) {
        if (data === undefined) {
            //
            // If no argument is passed then implicitly use the
            // useFetch response through which this update call was made.
            //
            data = this;
        }
        if (data?.__usefetch_response__ === true) {
            //
            // If the argument is the useFetch response itself then
            // implicitly use the data associated with that response.
            //
            data = data.data;
        }
        if (this && this.__usefetch_response__ && (this.data !== data)) {
            //
            // If data argument is different, by reference, than the current
            // data associated with the useFetch response through which this
            // update call was made, then we can do a simple setData since
            // React, in such a case, will update the data state properly.
            //
            // Otherwise, below, since the object references are the same,
            // by default React will not update the state, since it does
            // not update if the references are the same; this is usually
            // not what we want, so this update function will force an
            // update by impliclitly creating a new (appropriate) object.
            //
            setData(data);
        }
        else if (Type.IsObject(data)) {
            setData({...data});
        }
        else if (Type.IsArray(data)) {
            setData([...data]);
        }
        else if (Type.IsFunction(data)) {
            setData(data());
        }
        else {
            setData(data);
        }
    }
    const refresh = function(url, args) {
        _doFetch(assembleArgs(url, args, true),
                 this && this.__usefetch_response__ === true ? this.data : undefined);
        return response;
    };
    const response = {
        data: data,
        loading: loading,
        status: status,
        timeout: timeout,
        error: error,
        set: setData,
        __usefetch_response__: true
    };
    response.update = update.bind(response)
    response.refresh = refresh.bind(response)
    return response;
}

// This useFetchFunction React hook, like useFetch, is also used to centrally facilitate HTTP fetches,
// and also ties into a globally tracked list of all outstanding (and completed) fetches. But this
// is simpler. It doesn't setup any state like useFetch, except for the aforementioned global
// fetches/fetched state - which BTW is actually why we need a hook rather than a simple function.
// This hook returns a fetch function which takes the same kind of arguments as useFetch.
// Of particular interest in this case are the onData and onDone function callbacks,
// which (since no associated state is setup) is how the caller of the returned function
// gets a handle on the fetched data and on the fetch status.
//
// Stated more plainly: This hook can be use to obtain a simple (stateless) fetch function which
// can be used just as you'd expect, passing into it in an url, and an onData and/or onDone
// callback function to grab the results of the fetch. Any arguments passed to this hook
// act as fallback arguments to those passed into the actual fetch function call.
//
// You may ask: Why do we need this hook to return us a simple function; why not just
// define a fetch function and use it? The answer is that since we want to centerally,
// globally, and transparently track outstanding and completed fetches, and since these
// are maintained by global React state (via useFetching, useFetched, useGlobal hooks),
// and since React is very particular about where such hooks are used (only allowed within
// components or other hooks), we need to wrap access to the fetch function within a hook.
// Once this function is gotten from where it's okay to call a hook, we can use it
// anywhere where a hook connot be called, e.g. within a callback function.
//
export const useFetchFunction = (url = null, args = null) => {

    const fetching = _useFetching();
    const fetched = _useFetched();

    function assembleArgs(urlOverride, argsOverride) {
        return _assembleFetchArgs(url, args, urlOverride, argsOverride,
                                  () => {}, () => {}, () => {}, () => {}, () => {},
                                  fetching, fetched, true);
    }

    return (url, args) => _doFetch(assembleArgs(url, args));
}

// Readonly exported hook to get the list of currently fetching.
// See ADDITIONALLY section in useFetch comments above.
//
export const useFetching = () => {
    return [ Array.from(useGlobal(_fetchingData)[0].values()) ];
}

// Readonly exported hook to get the list of completed fetches.
// See ADDITIONALLY section in useFetch comments above.
//
export const useFetched = () => {
    return [ useGlobal(_fetchedData)[0] ];
}

// -------------------------------------------------------------------------------------------------
// Internal use only.
// -------------------------------------------------------------------------------------------------

const _fetchingData = defineGlobal(new Map());
const _fetchedData  = defineGlobal([]);

const _useFetching = () => {
    const [ fetching, setFetching ] = useGlobal(_fetchingData);
    const add = (fetch) => {
        const id = uuid();
        fetch.id = id;
        fetch.timestamp = new Date();
        fetching.set(id, fetch);
        setFetching(fetching);
		return id;
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
    const [ fetched, setFetched ] = useGlobal(_fetchedData);
    const add = (fetch, data) => {
        //
        // Note the next line causes the fetched data to be
        // included within the global list of completed fetches.
        //
        fetch.data = data;
        fetch.duration = new Date() - fetch.timestamp;
        if (fetched.length >= MAX_SAVE) {
            //
            // Maximum number of saved fetches reached;
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

// Internal _doFetch function to actually do the fetch using the Axios library.
// Assumes args have been validated and setup properly; must contain (exhaustively):
// url, setData, onData, onDone, onError, timeout, delay, nologout, noredirect,
// setLoading, setStatus, setTimeout, setError, fetching, fetched. Second (current)
// argument is only set when called via the refresh function returned by the useFetch
// hook; it is the previous (current, at this point) fetched data.
//
const _doFetch = (args, current = undefined) => {

    function handleResponse(response, id) {
        const status = response.status;
        Debug.Info(`FETCH RESPONSE: ${args.url} -> HTTP ${status}`);
        Debug.Info(response.data);
        //
        // This current argument is only set in the case where this is being
        // called from the refresh function returned by useFetch; it is the value
        // of the previously fetched (i.e. current) data, if any, otherwise null.
        //
        let data = args.onData(response.data, current);
        //
        // The next lines specify that if the onDone callback returns
        // nothing (undefined) then we set the data to, well, the data.
        //
        if (data === undefined) {
            data = response.data;
        }
        args.setData(data);
        args.setStatus(status);
        args.setLoading(false);
        noteFetchEnd(id, data);
        const onArg = { data: data, loading: false, status: status, timeout: false, error: null };
        args.onDone(onArg);
    }

    function handleError(error, id) {
        let status = error.response?.status || 0;
        Debug.Info(`FETCH ERROR: ${args.url} -> HTTP ${status}`);
        args.setData(null);
        args.setStatus(status);
        args.setError(error.message);
        args.setLoading(false);
        if (status === 401) {
            //
            // If we EVER get an HTTP 401 (not authenticated)
            // then we just logout the user, unless this behavior is disabled.
            //
            if (!args.nologout) {
                Logout();
            }
        }
        else if (status === 403) {
            //
            // If we EVER get an HTTP 403 (not authorized)
            // then redirect to th the /env page, unless this behavior is disabled.
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
        const onArg = { data: null, loading: false, status: status, timeout: status === 408, error: error.message };
        args.onError(onArg);
        args.onDone(onArg);
    }

    function noteFetchBegin(fetch) {
        return args.fetching.add(fetch);
    }

    function noteFetchEnd(id, data) {
        args.fetched.add(args.fetching.remove(id), data);
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

    // Expand to handle otther verb later (e.g. PUT, POST).

    const method = "GET";
    const payload = null;
    const fetch = { url: args.url, method: method, data: payload, timeout: args.timeout, withCredentials: "include" };

    Debug.Info(`FETCH: ${args.url}`);

    // Finally, the actual (Axois based) HTTP fetch happens here.

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
            Debug.Info(`FETCH EXCEPTION: ${args.url}`);
            Debug.Info(error);
            handleError(error, id);
        });
}

function _assembleFetchArgs(url, args, urlOverride, argsOverride,
                            setData, setLoading, setStatus, setTimeout, setError,
                            fetching, fetched, nonofetch) {
    if (Type.IsObject(url)) {
        args = url;
        url = null;
    }
    if (Type.IsObject(urlOverride)) {
        argsOverride = urlOverride;
        urlOverride = null;
    }
    args = {
        url:        Type.First([ urlOverride, argsOverride?.url, url, args?.url, "" ], Str.HasValue),
        onData:     Type.First([ argsOverride?.onData, args?.onData, () => {} ], Type.IsFunction),
        onDone:     Type.First([ argsOverride?.onDone, args?.onDone , () => {}], Type.IsFunction),
        onError:    Type.First([ argsOverride?.onError, args?.onError , () => {}], Type.IsFunction),
        timeout:    Type.First([ argsOverride?.timeout, args?.timeout, DEFAULT_TIMEOUT ], Type.IsInteger),
        delay:      Type.First([ argsOverride?.delay, args?.delay, DEFAULT_DELAY() ], Type.IsInteger),
        nologout:   Type.First([ argsOverride?.nologout, args?.nologout, false ], Type.IsBoolean),
        noredirect: Type.First([ argsOverride?.noredirect, args?.noredirect, false ], Type.IsBoolean),
        nofetch:    Type.First([ argsOverride?.nofetch, args?.nofetch, false ], Type.IsBoolean),
        setData:    setData,
        setLoading: setLoading,
        setStatus:  setStatus,
        setTimeout: setTimeout,
        setError:   setError,
        fetching:   fetching,
        fetched:    fetched
    };
    if (nonofetch) {
        delete args.nofetch;
    }
    return args;
}
