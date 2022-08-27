import './App.css';
import React from 'react';
import { useContext } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import * as URL from "./URL.js";
import { BarSpinner } from "./Spinners.js";
import { Logout } from "./LoginUtils.js";

const Header = (props) => {

    let navigate = useNavigate();
    const [ info, setInfo ] = useContext(GlobalContext);
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
            <NavLink to={URL.Url("/view", true)} style={({isActive}) => style(isActive)}>HOME</NavLink>&nbsp;|&nbsp;
            <NavLink to={URL.Url("/users", true)} style={({isActive}) => style(isActive)}>USERS</NavLink>&nbsp;|&nbsp;
            <NavLink to={URL.Url("/info", true)} style={({isActive}) => style(isActive)}>INFO</NavLink>&nbsp;|&nbsp;
            <a target="_blank" title="Open AWS Console for this account ({info.app?.credentials.aws_account_number}) in another tab."
                style={{textDecoration:"none",color:"darkgreen"}}
                href={"https://" + info.app?.credentials.aws_account_number + ".signin.aws.amazon.com/console/"}>AWS <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span></a>
        </span>
    }

    return <>
        <div style={{width:"100%",background:"#143c53"}}>{ info.loading ? (
            <table style={{width:"100%",height:"42px"}}><tbody>
            <tr>
                <td width="400" style={{height:"42px",paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href="">
                        <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                    </a>
                </td>
                <td width="400" style={{color:"white", nowrap:"1"}}>
                    <i style={{fontSize:"16pt",color:"yellow"}}>
                        Foursight Loading ...
                    </i>
                </td>
                <td width="10%" align="right">
                    <span style={{position:"relative",bottom:"5pt"}}>&nbsp;<BarSpinner loading={info.loading} color={'lightyellow'} size={150} /></span>
                </td>
            </tr>
            </tbody></table>
        ):(<React.Fragment>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
            <tr title={"App Deployed:" + info.app?.deployed + " | App Launched: " + info.app?.launched + " | Page Loaded: " + info.page?.loaded}>
                <td width="400" style={{paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href={info.page?.context + 'view/' + info.app?.env}>
                        <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                    </a>
                </td>
                <td align="center" style={{whiteSpace:"nowrap"}}>
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
                <td width="400" style={{paddingRight:"10pt",whiteSpace:"nowrap",color:"#D6EAF8"}} align="right">
                    <small>{info.page?.loaded}</small>
                    &nbsp;<b>|</b>&nbsp;
                    <a style={{textDecoration:"none",color:"#D6EAF8"}} href="{info.page?.context + '__reload_lambda__/' + info.app?.env + '/current'}" title="Click to relaunch this app." onClick={() => { if (window.confirm('Do you want to relaunch this app?')){return true;}else{window.event.stopPropagation();window.event.preventDefault()}}}>&#x2318;</a>
                    &nbsp;<b>|</b>&nbsp; <span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => {Logout(navigate);}}>LOGOUT</span>
                </td>
            </tr>
            </tbody></table>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
                <tr style={{background:"#AED6F1"}}>
                    <td width="400" style={{paddingLeft:"10pt",paddingTop:"3pt",paddingBottom:"3pt",whiteSpace:"nowrap"}}>
                        {renderNavigationLinks(info)}
                    </td>
                    <td align="center" style={{whiteSpace:"nowrap"}}>
                        <a target="_blank" href={"https://pypi.org/project/foursight-cgap/" + info.app?.version + "/"}><b title="Version of: foursight-cgap" style={{textDecoration:"none",color:"#263A48"}}>{info.app?.version}</b></a>
                    </td>
                    <td width="400" style={{paddingRight:"10pt",paddingTop:"2pt",paddingBottom:"1pt",whiteSpace:"nowrap"}} align="right" nowrap="1">
                        { (info.envs?.unique_annotated.length > 0) ? (
                        <span className="dropdown">
                            <b className="dropdown-button" style={{color:"#143c53"}} title="Environment: {URL.Env()}">{URL.Env().toUpperCase()}</b>
                            <div className="dropdown-content" id="dropdown-content-id">
                                { info.envs?.unique_annotated.map(env => 
                                    env.name.toUpperCase() == URL.Env().toUpperCase() || env.full.toUpperCase() == URL.Env().toUpperCase() || env.short.toUpperCase() == URL.Env().toUpperCase() || env.inferred.toUpperCase() == URL.Env().toUpperCase() ? (
                                        <span key={env.full}>{env.full}&nbsp;&nbsp;&#x2713;</span>
                                    ):(
                                        <a key={env.full} onClick={()=>{navigate(URL.Url(null, env.full))}}>{env.full}</a>
                                    )
                                )}
                                <div height="1" style={{marginTop:"2px",height:"1px",background:"darkblue"}}></div>
                                <a id="__envinfo__" onClick={()=>{navigate(URL.Url("/info", true));document.getElementById("__envinfo__").style.fontWeight="bold";}}>Environments Info</a>
                            </div>
                         </span>
                        ):(
                            <b style={{color:"#143c53"}} title="Environment: {URL.Env()}">asdfadfadf{URL.Env().toUpperCase()}</b>
                        )}
                        &nbsp;|&nbsp;
                        { (info.app?.stage == 'prod') ? (<span>
                            <b title="Deployment stage: PROD!" style={{color:"red"}}>PROD</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (info.app?.stage == 'dev') ? (<span>
                            <b title="Deployment stage: DEV" style={{color:"darkgreen"}}>DEV</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (info.app?.stage != 'prod' && info.app?.stage != 'dev') ? (<span>
                            <b title="Deployment stage: {info.app?.stage}">{info.app?.stage}}</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (info.login?.admin) ? (<span>
                            { (info.login?.email_address) ? (<span>
                                <Link to={URL.Url("/login", true)} style={{textDecoration:"none"}}><b title="" style={{color:"darkblue"}} title="Logged in as.">{info?.login?.email_address}</b></Link>
                            </span>):(<span>
                                <b style={{color:"darkblue"}}>ADMIN</b>
                            </span>)}
                        </span>):(<span>
                            <Link to={URL.Url("/login", true)} style={{cursor:"pointer",fontWeight:"bold",color:"darkred"}} title="Not logged in. Click to login.">LOGIN</Link>
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
