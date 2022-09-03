import './App.css';
import React from 'react';
import { useContext } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import * as URL from "./URL.js";
import * as API from "./API.js";
import { BarSpinner } from "./Spinners.js";
import { GetLoginInfo, IsLoggedIn, Logout } from "./LoginUtils.js";
import { fetchData } from "./FetchUtils.js";

const Header = (props) => {

    let navigate = useNavigate();
    const [ info ] = useContext(GlobalContext);
    const path = window.location.pathname;

    function renderNavigationLinks(info) {
        function style(isActive) {
            if (isActive) {
                return { textDecoration: "none", color: "black", fontWeight: "bold" }
            }
            else {
                return { textDecoration: "none", color: "blue", fontWeight: "normal" }
            }
        }
        return <span>
            <NavLink to={URL.Url("/home", true)} style={({isActive}) => style(isActive)}>HOME</NavLink>&nbsp;|&nbsp;
            <NavLink to={URL.Url("/checks", true)} style={({isActive}) => style(isActive)}>CHECKS</NavLink>&nbsp;|&nbsp;
            <NavLink to={URL.Url("/users", true)} style={({isActive}) => style(isActive)}>USERS</NavLink>&nbsp;|&nbsp;
            <NavLink to={URL.Url("/envs", true)} style={({isActive}) => style(isActive)}>ENV</NavLink>&nbsp;|&nbsp;
            <NavLink to={URL.Url("/info", true)} style={({isActive}) => style(isActive)}>INFO</NavLink>&nbsp;|&nbsp;
            <a target="_blank" title="Open AWS Console for this account ({info.app?.credentials.aws_account_number}) in another tab."
                style={{textDecoration:"none",color:"darkgreen"}}
                href={"https://" + info.app?.credentials.aws_account_number + ".signin.aws.amazon.com/console/"}>AWS <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span></a>
        </span>
    }

    function initiateAppReload() {
        const url = API.Url("/reloadlambda", false);
        fetchData(url);
    }

    return <>
        <div style={{width:"100%",background:"#143c53"}}>{ info.loading ? (
            <table style={{width:"100%",height:"42px"}}><tbody>
            <tr>
                <td width="1%" style={{height:"42px",paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href="">
                        <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                        <img src="/public/4dn_logo.png" width="130" />
                    </a>
                </td>
                <td width="98%" align="center" style={{fontSize:"16pt",color:"white", nowrap:"1"}}>
                    { info.error ? (<span>
                        <b style={{color:"red"}}>
                            Foursight Load Error
                        </b>
                    </span>):(<span>
                        <i style={{color:"yellow"}}>
                            Foursight Loading ...
                        </i>
                    </span>)}
                </td>
                <td width="1%" align="right">
                    <span style={{position:"relative",bottom:"5pt"}}>&nbsp;<BarSpinner loading={info.loading && !info.error} color={'lightyellow'} size={150} /></span>
                </td>
            </tr>
            </tbody></table>
        ):(<React.Fragment>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
            <tr title={"App Deployed:" + info.app?.deployed + " | App Launched: " + info.app?.launched + " | Page Loaded: " + info.page?.loaded}>
                <td width="33%" style={{paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href={URL.Url("/home", true)}>
                        <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                    </a>
                </td>
                <td width="34%" align="center" style={{whiteSpace:"nowrap"}}>
                    <span style={{fontSize:"20pt",color:"white"}}>
                        <span style={{color:"default"}}>{info.page?.title}</span>&nbsp;
                        { info.app?.stage == 'dev' ? (<span>
                            &nbsp;<span title="Stage is DEV." style={{position:"relative",top:"1pt",color:"lightgreen",fontSize:"24pt"}}>&#x269B;</span>
                        </span>):(<span></span>)}
                        { info.app?.local ? (<span>
                            &nbsp;<span title="Running locally." style={{position:"relative",bottom:"1pt",color:"lightgreen",fontSize:"15pt"}}>&#8861;</span>
                        </span>):(<span></span>)}
                    </span>
                </td>
                <td width="33%" style={{paddingRight:"10pt",whiteSpace:"nowrap",color:"#D6EAF8"}} align="right">
                    <small>{new Date().toLocaleDateString('en-us', { weekday:"long", year:"numeric", month:"long", day:"numeric"})}</small>
                    &nbsp;<b>|</b>&nbsp;
                    <span style={{textDecoration:"none",color:"#D6EAF8",cursor:"pointer"}} title="Click to relaunch this app." onClick={() => { if (window.confirm('Do you want to relaunch this app?')){initiateAppReload();return true;}else{window.event.stopPropagation();window.event.preventDefault()}}}>&#x2318;</span>
                    { (IsLoggedIn()) ? (<span>
                        &nbsp;<b>|</b>&nbsp; <span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => {Logout(navigate);}}>LOGOUT</span>
                    </span>):(<span>
                    </span>)}
                </td>
            </tr>
            </tbody></table>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
                <tr style={{background:"#AED6F1"}}>
                    <td width="49%" style={{paddingLeft:"10pt",paddingTop:"3pt",paddingBottom:"3pt",whiteSpace:"nowrap"}}>
                        {renderNavigationLinks(info)}
                    </td>
                    <td width="2%" align="center" style={{whiteSpace:"nowrap",margin:"0 auto"}}>
                        <a target="_blank" href={"https://pypi.org/project/foursight-cgap/" + info.app?.version + "/"}><b title="Version of: foursight-cgap" style={{textDecoration:"none",color:"#263A48"}}>{info.app?.version}</b></a>
                    </td>
                    <td width="49%" style={{paddingRight:"10pt",paddingTop:"2pt",paddingBottom:"1pt",whiteSpace:"nowrap"}} align="right" nowrap="1">
                        { (info.envs?.unique_annotated.length > 0) ? (
                        <span className="dropdown">
                            <b className="dropdown-button" style={{color:!URL.Env() || info.env_unknown ? "red" : "#143c53"}} title={"Environment: " + URL.Env() + (!URL.Env() || info.env_unknown ? " -> UNKNOWN" : "")}>{URL.Env().toUpperCase() || "UNKNOWN ENV"}</b>
                            <div className="dropdown-content" id="dropdown-content-id">
                                { info.envs?.unique_annotated.map(env => 
                                    env.name.toUpperCase() == URL.Env().toUpperCase() || env.full.toUpperCase() == URL.Env().toUpperCase() || env.short.toUpperCase() == URL.Env().toUpperCase() || env.foursight.toUpperCase() == URL.Env().toUpperCase() ? (
                                        <span key={env.full}>{env.full}&nbsp;&nbsp;&#x2713;</span>
                                    ):(
                                        /* <a key={env.full} onClick={()=>{navigate(URL.Url(null, env.full))}}>{env.full}</a> */
                                        <a key={env.full} href={URL.Url("/envs", env.full)}>{env.full}</a>
                                    )
                                )}
                                <div height="1" style={{marginTop:"2px",height:"1px",background:"darkblue"}}></div>
                                <a id="__envinfo__" onClick={()=>{navigate(URL.Url("/envs", true));document.getElementById("__envinfo__").style.fontWeight="bold";}}>Environments Info</a>
                            </div>
                         </span>
                        ):(
                            <b style={{color:"#143c53"}} title="Environment: {URL.Env()}">{URL.Env().toUpperCase()}</b>
                        )}
                        &nbsp;|&nbsp;
                        { (info.app?.stage == 'prod') ? (<span>
                            <b title="Deployment stage: PROD!" style={{color:"darkred"}}>PROD</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (info.app?.stage == 'dev') ? (<span>
                            <b title="Deployment stage: DEV" style={{color:"darkgreen"}}>DEV</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (info.app?.stage != 'prod' && info.app?.stage != 'dev') ? (<span>
                            <b title="Deployment stage: {info.app?.stage}">{info.app?.stage}}</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (IsLoggedIn()) ? (<span>
                            {/* TODO: on first login the email does not appear but rather LOGIN - on refresh OK */}
                            {/* TODO: also on LOGOUT the emai remains even on refresh - think that's the server-side caching which is bad idea - need to cache just a new /header endpoint */}
                            { GetLoginInfo()?.email ? (<span>
                                <Link to={URL.Url("/login", true)} style={{textDecoration:"none"}}><b title="" style={{color:"darkblue"}} title="Logged in as.">{GetLoginInfo()?.email}</b></Link>
                            </span>):(<span>
                                { info.login?.admin ? (<span>
                                    <b style={{color:"darkblue"}}>ADMIN</b>
                                </span>):(<span>
                                    <b style={{color:"darkblue"}}>SOMEUSER</b>
                                </span>)}
                            </span>)}
                        </span>):(<span>
                            <NavLink to={URL.Url("/login", true)} style={{cursor:"pointer",fontWeight:"bold",color:"darkred"}} title="Not logged in. Click to login.">LOGIN</NavLink>
                        </span>)}
                    </td>
                </tr>
                <tr>
                    <td style={{height:"1px",background:"darkblue"}}></td>
                </tr>
            </tbody></table>
        </React.Fragment>)}</div>
    </>
};

export default Header;
