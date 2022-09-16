import './css/App.css';
import React from 'react';
import { useContext, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import GlobalContext from "./GlobalContext";
import * as URL from "./utils/URL";
import { BarSpinner } from "./Spinners";
import { fetchData } from "./utils/FetchUtils";
import { GetLoginInfo, IsFauxLoggedIn, IsLoggedIn, Logout } from "./utils/LoginUtils";
import AUTH from './utils/AUTH';
import CLIENT from './utils/CLIENT';
import SERVER from './utils/SERVER';
import TIME from './utils/TIME';

const Header = (props) => {

    let { environ } = useParams();
    let navigate = useNavigate();
    const [ header, setHeader ] = useContext(GlobalContext);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);

    let isFoursightFourfront = header.app?.package != "foursight-cgap";
    let titleBackgroundColor = isFoursightFourfront ? "#14533C" : "#143C53";
    let subTitleBackgroundColor = isFoursightFourfront ? "#AEF1D6" : "#AED6F1";

    function refreshHeaderData(env) {
        const url = SERVER.Url("/header", env.public);
        fetchData(url, setHeader, setLoading, setError);
    }

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
            <NavLink to={CLIENT.Path("/home")} style={({isActive}) => style(isActive)}>HOME</NavLink>&nbsp;|&nbsp;
            <NavLink to={CLIENT.Path("/checks")} style={({isActive}) => style(isActive)}>CHECKS</NavLink>&nbsp;|&nbsp;
            <NavLink to={CLIENT.Path("/users")} style={({isActive}) => style(isActive)}>USERS</NavLink>&nbsp;|&nbsp;
            <NavLink to={CLIENT.Path("/env")} style={({isActive}) => style(isActive)}>ENV</NavLink>&nbsp;|&nbsp;
            <NavLink to={CLIENT.Path("/info")} style={({isActive}) => style(isActive)}>INFO</NavLink>&nbsp;|&nbsp;
            <a target="_blank" title="Open AWS Console for this account ({header.app?.credentials.aws_account_number}) in another tab."
                style={{textDecoration:"none",color:"darkgreen"}}
                href={"https://" + header.app?.credentials.aws_account_number + ".signin.aws.amazon.com/console/"}>AWS <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span></a>
        </span>
    }

    function getDefaultEnv() {
        return header?.env?.default;
    }

    function initiateAppReload() {
        const url = SERVER.Url("/reloadlambda", false);
        fetchData(url);
    }
        console.log('HEADER....')
        console.log(header)

    return <>
        { header.loading ? (
            <div style={{width:"100%"}}>
            <table style={{width:"100%",height:"42px",background:"#444444"}}><tbody>
            <tr>
                <td width="1%" style={{height:"42px",paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <div style={{width:"200px"}} />
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
                    <span style={{position:"relative",bottom:"5pt"}}>&nbsp;<BarSpinner loading={header.loading && !header.error} color={'yellow'} size={150} style={{marginRight:"20px"}}/></span>
                </td>
            </tr>
            </tbody></table>
            <table style={{width:"100%",height:"22px",background:"lightgray"}}><tbody>
            <tr><td style={{height:"27px",paddingLeft:"2pt",whiteSpace:"nowrap",background:"lightgray"}} /></tr>
            <tr><td style={{height:"20px",paddingLeft:"2pt",whiteSpace:"nowrap",background:"lightyellow"}} /></tr>
            </tbody></table>
            </div>
        ):(<React.Fragment>
            <div style={{width:"100%",background:titleBackgroundColor}}>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
            <tr title={"App Deployed:" + header.app?.deployed + " | App Launched: " + header.app?.launched + " | Page Loaded: " + header.page?.loaded}>
                <td width="33%" style={{paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href={isFoursightFourfront ? ("https://" + header.env?.public_name + ".4dnucleome.org/") : "https://cgap.hms.harvard.edu/"} target="_blank">
                        { isFoursightFourfront ? (<span>
                            <img style={{marginLeft:"14px",marginTop:"5px",marginBottom:"5px"}} src="https://data.4dnucleome.org/static/img/favicon-fs.ico" height="32" width="44" />
                        </span>):(<span>
                            <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                        </span>)}
                    </a>
                </td>
                <td width="34%" align="center" style={{whiteSpace:"nowrap"}}>
                    <span style={{fontSize:"20pt",color:"white"}}>

                        { header.app?.stage == 'dev' ? (<span>
                            <span title="Stage is DEV." style={{position:"relative",top:"1pt",color:"yellow",fontSize:"24pt"}}>&#x269B;</span>&nbsp;&nbsp;
                        </span>):(<span></span>)}
                        { header.app?.local ? (<span>
                            <span title="Running locally." style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"15pt"}}>&#8861;</span>&nbsp;&nbsp;
                        </span>):(<span></span>)}

                        <span style={{color:"default"}}>{header.page?.title}</span>&nbsp;

                        { header.app?.stage == 'dev' ? (<span>
                            &nbsp;<span title="Stage is DEV." style={{position:"relative",top:"1pt",color:"yellow",fontSize:"24pt"}}>&#x269B;</span>
                        </span>):(<span></span>)}
                        { header.app?.local ? (<span>
                            &nbsp;<span title="Running locally." style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"15pt"}}>&#8861;</span>
                        </span>):(<span></span>)}

                    </span>
                </td>
                <td width="33%" style={{paddingRight:"10pt",whiteSpace:"nowrap",color:"#D6EAF8"}} align="right">
                    <small>{TIME.FormatDateTime(new Date(), true)}</small>
                    { (AUTH.IsLoggedIn(header)) ? (<span>
                            {/* &nbsp;<b>|</b>&nbsp; <span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => {Logout(navigate);}}>LOGOUT</span> */}
                            {/* &nbsp;|&nbsp; <NavLink to={URL.Url("/logindone", true)} style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => Logout()}>LOGOUT</NavLink> */}

                            {/* &nbsp;|&nbsp; <NavLink to={{pathname: "/redirect"}} state={{url: URL.Url("/login", true)}}    style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => Logout()}>LOGOUT</NavLink> */}
                            {/* &nbsp;|&nbsp; <a href={"http://localhost:8000/api/reactapi/" + URL.Env() + "/logout"} style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => Logout()}>LOGOUT</a> */}
                            {/* &nbsp;|&nbsp; <span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => { Logout(); window.location.replace("http://localhost:8000/api/reactapi/" + URL.Env() + "/logout"); }}>LOGOUT</span> */}
                            &nbsp;|&nbsp; <span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => AUTH.Logout()}>LOGOUT</span>
                    </span>):(<span>
                        &nbsp;|&nbsp; <NavLink to={CLIENT.Path("/login?auth")} style={{cursor:"pointer",color:"#D6EAF8"}} title="Not logged in. Click to login.">LOGIN</NavLink>
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
                            <b className="dropdown-button" style={{color:!CLIENT.Env() || header.env_unknown ? "red" : "#143c53"}} title={"Environment: " + CLIENT.Env() + (!CLIENT.Env() || header.env_unknown ? " -> UNKNOWN" : "")}>{header.env?.public_name || "unknown-env"}</b>
                            <div className="dropdown-content" id="dropdown-content-id" style={{background:subTitleBackgroundColor}}>
                                { header.envs?.unique_annotated.map(env => 
                                    env.name.toUpperCase() == CLIENT.Env().toUpperCase() || env.full.toUpperCase() == CLIENT.Env().toUpperCase() || env.short.toUpperCase() == CLIENT.Env().toUpperCase() || env.foursight.toUpperCase() == CLIENT.Env().toUpperCase() ? (
                                        <span key={env.public}>{env.public}&nbsp;&nbsp;&#x2713;</span>
                                    ):(
                                            /* <Link key={env.public} onClick={() => refreshHeaderData(env)} to={URL.Url(null, env.public)}>{env.public}</Link> */
                                            /* TODO: rework this whole URL.Url stuff with no env etc */
                                        <Link key={env.public} onClick={() => refreshHeaderData(env)} to={{pathname: "/redirect"}} state={{url: !CLIENT.IsKnownEnv(CLIENT.Env()) ? CLIENT.Path("/env", getDefaultEnv()) : CLIENT.Path(null, env.public)}}>{env.public}</Link>
                                    )
                                )}
                                <div height="1" style={{marginTop:"2px",height:"1px",background:"darkblue"}}></div>
                                <Link id="__envinfo__" to={CLIENT.Path("/env")}onClick={()=>{document.getElementById("__envinfo__").style.fontWeight="bold";}}>Environments</Link>
                            </div>
                         </span>
                        ):(
                            <b style={{color:titleBackgroundColor}} title="Environment: {CLIENT.Env()}">{CLIENT.Env().toUpperCase()}</b>
                        )}
                        &nbsp;|&nbsp;
                        { (header.app?.stage == 'prod') ? (<>
                            <b title="Deployment stage: PROD!" style={{color:"darkred"}}>{header.app?.stage}</b> &nbsp;|&nbsp;
                        </>):(<></>)}
                        { (header.app?.stage == 'dev') ? (<>
                            <b title="Deployment stage: DEV" style={{color:"darkgreen"}}>{header.app?.stage}</b> &nbsp;|&nbsp;
                        </>):(<></>)}
                        { (header.app?.stage != 'prod' && header.app?.stage != 'dev') ? (<>
                            <b title="Deployment stage: {header.app?.stage}">{header.app?.stage}}</b> &nbsp;|&nbsp;
                        </>):(<></>)}
                        { (IsLoggedIn()) ? (<>
                            { AUTH.LoggedInUser(header) ? (<>
                                <Link to={CLIENT.Path("/login")} style={{textDecoration:"none"}}><b title="" style={{color:"darkblue"}} title="Logged in as.">{AUTH.LoggedInUser(header)}</b></Link>
                            </>):(<>
                                { (IsFauxLoggedIn()) ? (<>
                                    <span className={"tool-tip"} data-text="Running locally and faux logged in (i.e. not via Auth0).">
                                        <b style={{color:"darkred"}}>FAUX USER</b>
                                    </span>
                                </>):(<>
                                    <span className={"tool-tip"} data-text="Running locally and unknown user logged in.">
                                        <b style={{color:"darkred"}}>UNKNOWN USER</b>
                                    </span>
                                </>)}
                            </>)}
                        </>):(<>
                            <b>NOT LOGGED IN</b>
                        </>)}
                    </td>
                </tr>
                <tr>
                    <td style={{background:"lightyellow",color:"darkred",padding:"3pt"}} colSpan="3">
                        <i style={{fontSize:"small"}}>This is an <b>experimental</b> version of Foursight using <b>React</b>. For more info click <b><a href="https://hms-dbmi.atlassian.net/wiki/spaces/~627943f598eae500689dbdc7/pages/2882699270/Foursight+React" style={{color:"darkred"}} target="_blank"><u>here</u></a></b>.
                        To go to the real Foursight click <a href={CLIENT.IsLocal() && window.location.host == "localhost:3000" ? ("http://localhost:8000" + ("/api/view/" + header?.env?.public_name)) : ("/api/view/" + (header?.env?.public_name))} style={{color:"inherit"}}><b><u>here</u></b></a>.</i>
                    </td>
                </tr>
                <tr>
                    <td style={{height:"1px",background:"darkblue"}}></td>
                </tr>
            </tbody></table>
            </div></React.Fragment>)}
    </>
};

export default Header;
