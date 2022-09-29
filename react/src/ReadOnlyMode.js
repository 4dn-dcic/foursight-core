import { useState, useEffect } from 'react';
import Client from "./utils/Client";
import Cookie from "./utils/Cookie";
import Image from "./utils/Image";
import TYPE from "./utils/TYPE";

let _callbacks = [];

const ReadOnlyModeLock = function() {
    const [ readOnlyMode, setReadOnlyMode ] = useState(Client.IsReadOnlyMode());
    return <>
        { readOnlyMode ? <>
            <span className={"tool-tip"} data-text={"You are in readonly mode. Click to enter read/write mode."}>
                <img src={Image.Lock()}
                    style={{height:"30",cursor:"pointer"}}
                    onClick={() => {
                        setReadOnlyMode(false);
                        Cookie.SetReadOnlyMode(false);
                        for (let callback of _callbacks) {
                            callback(false);
                        }
                    }}/>
        
            </span>
        </>:<>
            <span className={"tool-tip"} data-text={"You are in read/write mode. Click to enter readonly mode."}>
                <img src={Image.Unlock()}
                    style={{height:"30",cursor:"pointer"}}
                    onClick={() => {
                        setReadOnlyMode(true);
                        Cookie.SetReadOnlyMode(true);
                        for (let callback of _callbacks) {
                            callback(true);
                        }
                    }}/>
            </span>
        </>}
    </>
}

// TODO
// How do I track this state locally within this component but use it elsewhere (e.g. pages/ChecksPage.js)?
// I want this to reach into the single instance of ReadOnlyLock and get the readOnlyMode state,
// without having to introduce global state. If this readOnlyMode variable were to be global
// we'd get too much re-rendering when it changed. Maybe solution involves create/useRef? Idunno yet.
// This seems totally lame.

function RegisterCallback(callback) {
    if (TYPE.IsFunction(callback)) {
        const index = _callbacks.indexOf(callback) > -1;
        if (index > -1) {
            _callbacks.push(callback);
            callback(Cookie.IsReadOnlyMode());
        }
    }
}

function UnregisterCallback(callback) {
    if (TYPE.IsFunction(callback)) {
        const index = _callbacks.indexOf(callback)
        if (index > -1) {
            _callbacks.splice(index, 1);
        }
    }
}

export default {
    Lock:               ReadOnlyModeLock,
    RegisterCallback:   RegisterCallback,
    UnregisterCallback: UnregisterCallback
}
