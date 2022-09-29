import { useState } from 'react';
import Client from "./utils/Client";
import Cookie from "./utils/Cookie";
import IMAGE from "./utils/IMAGE";

let _readOnlyModeCallbacks = [];

const ReadOnlyModeLock = function({state="foo"}) {
    const [ readOnlyMode, setReadOnlyMode ] = useState(Client.IsReadOnlyMode());
    return <>
        { readOnlyMode ? <>
            <span className={"tool-tip"} data-text={"You are in readonly mode. Click to enter read/write mode."}>
                <img src={IMAGE.Lock()}
                    style={{height:"30",cursor:"pointer"}}
                    onClick={() => { setReadOnlyMode(false); Cookie.SetReadOnlyMode(false); for (let f of _readOnlyModeCallbacks) f(false); }}/>
        
            </span>
        </>:<>
            <span className={"tool-tip"} data-text={"You are in read/write mode. Click to enter readonly mode."}>
                <img src={IMAGE.Unlock()}
                    style={{height:"30",cursor:"pointer"}}
                    onClick={() => { setReadOnlyMode(true); Cookie.SetReadOnlyMode(true); for (let f of _readOnlyModeCallbacks) f(true); }}/>
            </span>
        </>}
    </>
}

function IsReadOnlyMode() {
    return Cookie.IsReadOnlyMode();
}

// THIS IS WRONG! BUT IT WORKS FOR SHORT SHORT TERM!
// KEEPS CREATING NEW FUNCTIONS IN THE LIST!
// How do I track this state locally within this component but use it elsewhere (e.g. pages/ChecksPage.js)?
// I want this to reach into the single instance of ReadOnlyLock and get the readOnlyMode state,
// without having to introduce global state.
//
function ReadOnlyModeState() {
    const [ readOnlyMode, setReadOnlyMode ] = useState(IsReadOnlyMode());
    _readOnlyModeCallbacks.push(setReadOnlyMode);
    return readOnlyMode;
}

export default {
    IsReadOnlyMode: IsReadOnlyMode,
    Lock:           ReadOnlyModeLock,
    State:          ReadOnlyModeState
}
