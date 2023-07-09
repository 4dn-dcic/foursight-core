import React from 'react';
import { useEffect, useState, useRef } from 'react';
import useFetch from '../hooks/Fetch';
import { ExternalLink } from '../Components';
import Char from '../utils/Char';
import Clipboard from '../utils/Clipboard';
import Image from '../utils/Image';
import Json from '../utils/Json';
import Str from '../utils/Str';
import Tooltip from '../components/Tooltip';
import Type from '../utils/Type';
import Uuid from 'react-uuid';
import Yaml from '../utils/Yaml';
import { HorizontalLine } from '../Components';

const JsonToggleDiv = (props) => {
    const [ showJson, setShowJson ] = useState(props.showJson);
    const toggleJson = () => setShowJson(!showJson);
    const childrenRef = useRef(null);
    return props.disabled ? <>{props.children}</> : <div>
        { (props.both || !showJson) && <>
            <JsonToggleButton toggle={toggleJson} toggled={showJson} data={props.data} yaml={props.yaml} />
            <div ref={childrenRef}>
                {props.children}
            </div>
        </> }
        { showJson ? <>
            { props.both ? <>
                <HorizontalLine top="4pt" bottom="4pt" dotted={true} />
            </>:<>
                <small>
                    <b style={{float:"left"}}>{props.title || `Raw ${props.yaml ? "YAML" : "JSON"} Data`}</b>
                    <JsonToggleButton toggle={toggleJson} toggled={showJson} data={props.data} yaml={props.yaml} />
                </small>
                <br />
                <HorizontalLine top="4pt" bottom="4pt" dotted={true} />
            </> }
            <div style={{fontFamily:"monospace",whiteSpace:"pre",background:"inherit",width:"100%",maxWidth:childrenRef?.current?.offsetWidth}}>
                { props.yaml ? <>
                    {Yaml.Format(props.data)}
                </>:<>
                    {Json.Format(props.data)}
                </> }
            </div>
        </>:<>
        </> }
    </div>
}

const JsonToggleButton = (props) => {
    const style={
        fontFamily:"monospace",
            background: props.toggled ? "var(--box-fg)" : "inherit",
            color: props.toggled ? "var(--box-bg)" : "inherit",
            fontSize:"10pt",
            fontWeight: "bold",
            border:"1pt black solid",
            borderRadius:"3px",
            padding: "0px 1px 2px 1px",
            marginTop:"-1px",
            marginRight:"-4px",
            float:"right",
            cursor:"pointer",
            userSelect: "none"
    };
    const uuid = Uuid();
    return <div style={{float:"right"}}>
        { props.toggled && <span style={{cursor:"copy"}}>
            <span style={{fontSize:"0",opacity:"0"}} id={uuid}>{Json.Str(props.data)}</span>
            <img src={Image.Clipboard()} height="20" style={{marginRight:"4pt",marginTop:"-2px"}} id={`tooltip-copy-${uuid}`} onClick={() => Clipboard.Copy(uuid)} />
            <Tooltip id={`tooltip-copy-${uuid}`} position="bottom" size="small" text={`Click to copy raw JSON data to clipboard.`} />
        </span> }
        <b style={style} onClick={props.toggle} id={`tooltip-toggle-${uuid}`}>
            { props.toggled ? <>
                <span>&#x7B;&#x7D;</span>
            </>:<>
                <span>&#x7B;&#x7D;</span>
            </> }
        </b>
         <Tooltip id={`tooltip-toggle-${uuid}`} position="bottom" size="small" text={`Click to ${props.toggled ? "hide" : "show"} raw ${props.yaml ? "YAML" : "JSON"} data.`} />
    </div>
}

export default JsonToggleDiv;
