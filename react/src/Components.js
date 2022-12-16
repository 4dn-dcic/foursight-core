import { Link as ReactLink } from 'react-router-dom';
import React, { useState } from 'react';
import Auth from './utils/Auth';
import Client from './utils/Client';
import Char from './utils/Char';
import Image from './utils/Image';
import { PuffSpinner } from './Spinners';
import Str from './utils/Str';
import Time from './utils/Time';
import Type from './utils/Type';
import Styles from './Styles';

export const Link = ({to, env = true, tip = null, bold = true, children}) => {
    return <ReactLink className={tip ? "tool-tip" : ""} data-text={tip} to={Client.Path(to, env ? env : null)} style={{color:"inherit",fontWeight:bold ? "bold" : "inherit"}}>{children}</ReactLink>
}

export const HorizontalLine = ({top = "0", bottom = "0", thick = false, color = null }) => {
    return color ? 
           <div style={{background:color,height:thick ? "2px" : "1px",marginTop:top,marginBottom:bottom}}></div> :
           <div className="fgbg" style={{height:thick ? "2px" : "1px",marginTop:top,marginBottom:bottom}}></div>
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
            <Link to={link} tip={Time.Ago(Auth.LoggedInAt())}>{Auth.LoggedInUser()}</Link>
        </>:<>
            <span className="tool-tip" data-text={Time.Ago(Auth.LoggedInAt())}>{Auth.LoggedInUser()}</span>
        </>}
        { Auth.LoggedInViaGoogle() ? <>
            <span className="tool-tip" data-text="Google Authentication">
                <img alt="google" title="Via Google" style={{marginLeft:"9px",marginRight:"0",marginBottom:"2px"}} src={Image.GoogleLoginLogo()} height="15" />
            </span>
        </>:<>
            { Auth.LoggedInViaGitHub() && <>
                <span className="tool-tip" data-text="GitHub Authentication">
                    <img alt="github" title="Via GitHub" style={{marginLeft:"5px",marginRight:"-4px",marginBottom:"2px"}} src={Image.GitHubLoginLogo()} height="19" />
                </span>
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
