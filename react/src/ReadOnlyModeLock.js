import { useState } from 'react';
import Client from "./utils/Client";
import COOKIE from "./utils/COOKIE";
import IMAGE from "./utils/IMAGE";

const ReadOnlyModeLock = ({}) => {
    const [ readOnlyMode, setReadOnlyMode ] = useState(Client.IsReadOnlyMode());
    return <>
        { readOnlyMode ? <>
            <span className={"tool-tip"} data-text={"You are in readonly mode. Click to enter read/write mode."}>
                <img src={IMAGE.Lock()}
                    style={{height:"30",cursor:"pointer"}}
                    onClick={() => { setReadOnlyMode(false); COOKIE.SetReadOnlyMode(false); }}/>
        
            </span>
        </>:<>
            <span className={"tool-tip"} data-text={"You are in read/write mode. Click to enter readonly mode."}>
                <img src={IMAGE.Unlock()}
                    style={{height:"30",cursor:"pointer"}}
                    onClick={() => { setReadOnlyMode(true); COOKIE.SetReadOnlyMode(true); }}/>
            </span>
        </>}
    </>
}

export default ReadOnlyModeLock;
