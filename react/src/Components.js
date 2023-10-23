import { Link as ReactLink } from 'react-router-dom';
import React, { useState } from 'react';
import Auth from './utils/Auth';
import Client from './utils/Client';
import Char from './utils/Char';
import Image from './utils/Image';
import { PuffSpinner, PuffSpinnerInline } from './Spinners';
import Str from './utils/Str';
import Styles from './Styles';
import Time from './utils/Time';
import Tooltip from './components/Tooltip';
import Type from './utils/Type';
import Uuid from 'react-uuid';

export const Link = ({to, env = true, bold = true, id = null, children}) => {
    return <>
        <ReactLink to={Client.Path(to, env ? env : null)} style={{color:"inherit",fontWeight:bold ? "bold" : "inherit"}} id={id}>{children}</ReactLink>
    </>
}

export const HorizontalLine = ({top = "0", bottom = "0", thick = false, color = null, dotted = false, table = null, iff = true }) => {
    if (!iff) return <></>
    const borderColor = Str.HasValue(color) ? color : Styles.GetForegroundColor();
    const borderThickness = thick ? "2px" : "1px";
    const borderStyle = dotted ? "dotted" : "solid";
    const style = {
        borderBottom:`${borderThickness} ${borderColor} ${borderStyle}`,
        marginTop: top,
        marginBottom: bottom
    }
    if (Type.IsInteger(table)) {
        return <tr><td colSpan={table}><div style={style} /></td></tr>
    }
    else {
        return <div style={style} />
    }
}

export const LoggedInUser = ({ link = undefined}) => {
    if (link === "user") {
        link = "/users/" + Auth.LoggedInUser();
    }
    else if (link === undefined) {
        link = "/login";
    }
    return <>
        { (link) ? <>
            <Link id="tooltip-login" to={link} tip={Time.Ago(Auth.LoggedInAt())}>{Auth.LoggedInUser()}</Link>
            <Tooltip id="tooltip-login" position="bottom" text={Time.Ago(Auth.LoggedInAt())} />
        </>:<>
            <span id="tooltip-login-2">{Auth.LoggedInUser()}</span>
            <Tooltip id="tooltip-login-2" position="bottom" text={Time.Ago(Auth.LoggedInAt())} />
        </>}
        { Auth.LoggedInViaGoogle() ? <>
            <span id="tooltip-login-google">
                <img alt="google" title="Via Google" style={{marginLeft:"9px",marginRight:"0",marginBottom:"2px"}} src={Image.GoogleLoginLogo()} height="15" />
            </span>
            <Tooltip id="tooltip-login-google" position="bottom" text="Via Google authentication." />
        </>:<>
            { Auth.LoggedInViaGitHub() && <>
                <span id="tooltip-login-github">
                    <img alt="github" title="Via GitHub" style={{marginLeft:"5px",marginRight:"-4px",marginBottom:"2px"}} src={Image.GitHubLoginLogo()} height="19" />
                </span>
                <Tooltip id="tooltip-login-github" position="bottom" text="Via GitHub authentication." />
            </>}
        </>}
    </>
}

export const FetchErrorBox = ({ error, message, center }) => {
    const [ showDetails, setShowDetails ] = useState(false)
    if (!Str.HasValue(message)) {
        message = "Error retrieving data from Foursight API"
    }
    if (Type.IsString(error)) {
        error = { message: error };
    }
    else if (!Type.IsObject(error)) {
        error = { message: "Unknown error" }
    }
    return <div className={`box error thickborder ${center ? "container" : ""}`} style={{marginTop:"18pt",marginBottom:"8pt",maxWidth:"700pt", horizontalAlign:"center"}}>
        <b>{message}</b>
        { error?.details && <>
            <b onClick={() => setShowDetails(!showDetails)} style={{marginLeft:"6pt",verticalAlign:"top",cursor:"pointer"}}>{showDetails ? Char.DownArrow : Char.UpArrow}</b>
        </>}
        <small>
        <br />
        { (error?.url) && <> <br /><b>URL</b>: {error?.url} </>}
        { (error?.status > 0) && <><br /><b>Status</b>: {error?.status} {error?.code ? ` (${error.code})` : ""}</>}
        { showDetails && error?.details && <>
            <br />
            <b>Details</b>:&nbsp;
            <small>{error.details}</small>
        </>}
        </small>
    </div>
}

export const RefreshButton = (props) => {
    return <div className={props.refreshing ? "refreshing" : "refresh"} style={{...props.style}}>
        { props.refreshing ? <>
            <div style={{cursor:"not-allowed"}}>
                <PuffSpinner color={Styles.GetForegroundColor()} cssOverride={{}} size={"12pt"} />
            </div>
        </>:<span onClick={props.refresh}>{Char.Refresh}</span>}
    </div>
}

export const ExternalLink = (props) => {
    let style = {...props.style};
    if (props.nudgedown) {
        style = {...style, position: "relative", bottom: `-${props.nudgedown}`};
    }
    return <span style={style}>
        <a id={props.href} href={props.href} style={{color:props.color || "var(--box-fg)"}} rel="noreferrer" target="_blank" onClick={(e) => e.stopPropagation()}>
            {props.text && <span style={{fontWeight:props.bold ? "bold" : "normal",marginRight:"5pt"}}>{props.text}</span>}
            <span className="fa fa-external-link" style={{fontWeight:props.bold ? "bold" : "normal",position:"relative",bottom:"-0.5pt"}} />
        </a>
        { props.tooltip && <Tooltip id={props.href} text={props.tooltip} /> }
    </span>
}

export const GitHubLink = (props) => {
    if (!props.href) return null;
    return <span style={{position:"relative",bottom:"0pt",...props.style}}>
        <a id={props.href} rel="noreferrer" target="_blank" href={props.href}><img alt="github" src={Image.GitHubLoginLogo()} height="18"/></a>
        <Tooltip id={props.href} text={`Click to view source code for this ${props.type} (in new tab).`} />
    </span>
}

export const ToggleShowDetailArrow = ({ isShow, toggleShow, text = null, underline = null, size = null, left = null, right = null, float = null, color = null, bold = true, nudge = "" }) => {
    const uuid = Uuid();
    const style= {
        position: "relative",
        float: float || "inherit",
        top: nudge,
        left: left || "inherit",
        right: right || "inherit",
        color: color || "inherit",
        fontSize: size || "inherit",
        fontWeight: (bold === true) || (bold === "onshow" && isShow()) || (bold === "onhide" && !isShow()) ? "bold" : "inherit"
    };
    return <>
        <span className="pointer" style={style} onClick={toggleShow} id={uuid}>
            { text && <span style={{textDecoration: underline ? "underline" : "inherit", paddingRight: "2pt"}}>{text}</span> }
            { isShow() ? <>{Char.DownArrow}</> : <>{Char.UpArrow}</> }
            <Tooltip id={uuid} position="top" text={`Click to ${isShow() ? "hide" : "show"} details`} />
        </span>
    </>
}

export const Refresher = ({ refresh = () => null, refreshing = () => false, bold = false, size = "x-small", nudge = "0px" }) => {

    function toPixelSize(value) {
        if (value.endsWith("px")) return value;
        const numericValue = parseFloat(value);
        if (isNaN(numericValue)) throw new Error("Invalid size format");
        return numericValue * 1.5;
    }

    function normalizeFontSize(value) {
        if (value === "xx-small") return "8pt";
        else if (value === "x-small") return "10pt";
        else if (value === "small") return "13pt";
        else if (value === "medium") return "16pt";
        else if (value === "large") return "18pt";
        else if (value === "x-large") return "24pt";
        else if (value === "xx-large") return "32pt";
        else if (/^\d+$/.test(value)) return `${value}pt`;
        else return value;
    }

    const fontSize = normalizeFontSize(size)
    const spinnerSize = toPixelSize(fontSize);
    return <span className="pointer" onClick={(e) => { refresh(); e.stopPropagation(); e.preventDefault(); }}>
        { refreshing() ? <>
            <span style={{position: "relative", top: "1px"}}><PuffSpinnerInline size={`${spinnerSize}`} /></span>
        </>:<span style={{position: "relative", top: "0px", fontSize: `${fontSize}`, fontWeight: bold ? "bold" : "inherit"}}>
            {Char.Refresh}
        </span> }
    </span>
}
