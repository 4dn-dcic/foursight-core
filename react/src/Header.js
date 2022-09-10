import './App.css';
import React from 'react';
import { useContext } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import GlobalContext from "./GlobalContext";
import { IsRunningLocally } from './LoginUtils';
import { DeleteRedirectCookie } from './CookieUtils';
import * as URL from "./URL";
import * as API from "./API";
import { BarSpinner } from "./Spinners";
import { GetLoginInfo, IsLoggedIn, Logout } from "./LoginUtils";
import { fetchData } from "./FetchUtils";

const Header = (props) => {

    // Temporary hack so "real" (non-React) Foursight doesn't use this.
    //
    DeleteRedirectCookie();

    let { environ } = useParams();
    let navigate = useNavigate();
    const [ header ] = useContext(GlobalContext);
    const path = window.location.pathname;

    let isFoursightFourfront = header.app?.package != "foursight-cgap";
    let titleBackgroundColor = isFoursightFourfront ? "#14533C" : "#143C53";
    let subTitleBackgroundColor = isFoursightFourfront ? "#AEF1D6" : "#AED6F1";

    function renderNavigationLinks(header) {
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
            <a target="_blank" title="Open AWS Console for this account ({header.app?.credentials.aws_account_number}) in another tab."
                style={{textDecoration:"none",color:"darkgreen"}}
                href={"https://" + header.app?.credentials.aws_account_number + ".signin.aws.amazon.com/console/"}>AWS <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span></a>
        </span>
    }

    function initiateAppReload() {
        const url = API.Url("/reloadlambda", false);
        fetchData(url);
    }

    return <>
        <div style={{width:"100%",background:titleBackgroundColor}}>{ header.loading ? (
            <table style={{width:"100%",height:"42px"}}><tbody>
            <tr>
                <td width="1%" style={{height:"42px",paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href="">
                        { isFoursightFourfront ? (<span>
                            &nbsp;&nbsp;&nbsp;<img style={{marginLeft:"14px",marginTop:"5px",marginBottom:"5px"}} src="https://data.4dnucleome.org/static/img/favicon-fs.ico" height="32" />
                        </span>):(<span>
                            <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                        </span>)}
                    </a>
                </td>
                <td width="98%" align="center" style={{fontSize:"16pt",color:"white", nowrap:"1"}}>
                    { header.error ? (<span>
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
                    <span style={{position:"relative",bottom:"5pt"}}>&nbsp;<BarSpinner loading={header.loading && !header.error} color={'lightyellow'} size={150} /></span>
                </td>
            </tr>
            </tbody></table>
        ):(<React.Fragment>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
            <tr title={"App Deployed:" + header.app?.deployed + " | App Launched: " + header.app?.launched + " | Page Loaded: " + header.page?.loaded}>
                <td width="33%" style={{paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href={URL.Url("/home", true)}>
                        {/* TODO */}
                        { isFoursightFourfront ? (<span>
                            <img style={{marginLeft:"14px",marginTop:"5px",marginBottom:"5px"}} src="https://data.4dnucleome.org/static/img/favicon-fs.ico" height="32" />
                        </span>):(<span>
                            <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                        </span>)}
                    </a>
                </td>
                <td width="34%" align="center" style={{whiteSpace:"nowrap"}}>
                    <span style={{fontSize:"20pt",color:"white"}}>
                        <span style={{color:"default"}}>{header.page?.title}</span>&nbsp;
                        { header.app?.stage == 'dev' ? (<span>
                            &nbsp;<span title="Stage is DEV." style={{position:"relative",top:"1pt",color:"lightgreen",fontSize:"24pt"}}>&#x269B;</span>
                        </span>):(<span></span>)}
                        { header.app?.local ? (<span>
                            &nbsp;<span title="Running locally." style={{position:"relative",bottom:"1pt",color:"lightgreen",fontSize:"15pt"}}>&#8861;</span>
                        </span>):(<span></span>)}
                    </span>
                </td>
                <td width="33%" style={{paddingRight:"10pt",whiteSpace:"nowrap",color:"#D6EAF8"}} align="right">
                    <small>{new Date().toLocaleDateString('en-us', { weekday:"long", year:"numeric", month:"long", day:"numeric", hour12: false, hour: "2-digit", minute: "2-digit", second: "numeric", timeZoneName: "short"}).replace(" at ", " | ")}</small>
                    { (IsLoggedIn()) ? (<span>
                            {/* &nbsp;<b>|</b>&nbsp; <span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => {Logout(navigate);}}>LOGOUT</span> */}
                        &nbsp;|&nbsp; <NavLink to={URL.Url("/logindone", true)} style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => Logout()}>LOGOUT</NavLink>
                    </span>):(<span>
                        &nbsp;|&nbsp; <NavLink to={URL.Url("/login?auth", true)} style={{cursor:"pointer",color:"#D6EAF8"}} title="Not logged in. Click to login.">LOGIN</NavLink>
                    </span>)}
                </td>
            </tr>
            </tbody></table>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
                <tr style={{background:subTitleBackgroundColor}}>
                    <td width="49%" style={{paddingLeft:"10pt",paddingTop:"3pt",paddingBottom:"3pt",whiteSpace:"nowrap"}}>
                        {renderNavigationLinks(header)}
                    </td>
                    <td width="2%" align="center" style={{whiteSpace:"nowrap",margin:"0 auto"}}>
                        <a target="_blank" href={"https://pypi.org/project/" + (isFoursightFourfront ? "foursight" : "foursight-cgap") + "/" + header.app?.version + "/"}><b title="Version of: foursight-cgap" style={{textDecoration:"none",color:"#263A48"}}>{header.app?.version}</b></a>
                    </td>
                    <td width="49%" style={{paddingRight:"10pt",paddingTop:"2pt",paddingBottom:"1pt",whiteSpace:"nowrap"}} align="right" nowrap="1">
                        { (header.envs?.unique_annotated.length > 0) ? (
                        <span className="dropdown">
                            <b className="dropdown-button" style={{color:!URL.Env() || header.env_unknown ? "red" : "#143c53"}} title={"Environment: " + URL.Env() + (!URL.Env() || header.env_unknown ? " -> UNKNOWN" : "")}>{URL.Env() || "unknown-env"}</b>
                            <div className="dropdown-content" id="dropdown-content-id" style={{background:subTitleBackgroundColor}}>
                                { header.envs?.unique_annotated.map(env => 
                                    env.name.toUpperCase() == URL.Env().toUpperCase() || env.full.toUpperCase() == URL.Env().toUpperCase() || env.short.toUpperCase() == URL.Env().toUpperCase() || env.foursight.toUpperCase() == URL.Env().toUpperCase() ? (
                                        <span key={env.full}>{env.full}&nbsp;&nbsp;&#x2713;</span>
                                    ):(
                                        /* <a key={env.full} onClick={()=>{navigate(URL.Url(null, env.full))}}>{env.full}</a> */
                                        /* <a key={env.full} href={URL.Url("/envs", env.full)}>{env.full}</a> */
                                        /* TODO */
                                        /* <Link key={env.full} onClick={() => {setHeader(x => [...x]);}} to={URL.Url(null, env.full)}>{env.full}</Link> */
                                        /* <Link key={env.full} to={URL.Url(null, env.full)}>{env.full}</Link> */
                                        <a key={env.full} href={URL.Url(null, env.full)}>{env.full}</a>
                                    )
                                )}
                                <div height="1" style={{marginTop:"2px",height:"1px",background:"darkblue"}}></div>
                                <a id="__envinfo__" onClick={()=>{navigate(URL.Url("/envs", true));document.getElementById("__envinfo__").style.fontWeight="bold";}}>Environments Info</a>
                            </div>
                         </span>
                        ):(
                            <b style={{color:titleBackgroundColor}} title="Environment: {URL.Env()}">{URL.Env().toUpperCase()}</b>
                        )}
                        &nbsp;|&nbsp;
                        { (header.app?.stage == 'prod') ? (<span>
                            <b title="Deployment stage: PROD!" style={{color:"darkred"}}>{header.app?.stage}</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (header.app?.stage == 'dev') ? (<span>
                            <b title="Deployment stage: DEV" style={{color:"darkgreen"}}>{header.app?.stage}</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (header.app?.stage != 'prod' && header.app?.stage != 'dev') ? (<span>
                            <b title="Deployment stage: {header.app?.stage}">{header.app?.stage}}</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (IsLoggedIn()) ? (<span>
                            {/* TODO: on first login the email does not appear but rather LOGIN - on refresh OK */}
                            {/* TODO: also on LOGOUT the emai remains even on refresh - think that's the server-side caching which is bad idea - need to cache just a new /header endpoint */}
                            { GetLoginInfo()?.email ? (<span>
                                <Link to={URL.Url("/login", true)} style={{textDecoration:"none"}}><b title="" style={{color:"darkblue"}} title="Logged in as.">{GetLoginInfo()?.email}</b></Link>
                            </span>):(<span>
                                { header.login?.admin ? (<span>
                                    <b style={{color:"darkblue"}}>ADMIN</b>
                                </span>):(<span>
                                    <b style={{color:"darkblue"}}>SOMEUSER</b>
                                </span>)}
                            </span>)}
                        </span>):(<span>
                            <b>NOT LOGGED IN</b>
                        </span>)}
                    </td>
                </tr>
                <tr>
                    <td style={{background:"lightyellow",color:"darkred",padding:"3pt"}} colSpan="3">
                        <i style={{fontSize:"small"}}>This is an <b>experimental</b> version of Foursight using <b>React</b>.
                        Click <a href={IsRunningLocally() && window.location.host == "localhost:3000" ? "http://localhost:8000/api/view" : ("/api/view/" + (environ || header.env?.default))} style={{color:"inherit"}}><b>here</b></a> to go to the real version.</i>
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
