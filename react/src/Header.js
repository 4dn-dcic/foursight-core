import './css/App.css';
import React from 'react';
import { useContext, useState } from 'react';
import { Link, NavLink, useNavigate, useParams } from 'react-router-dom';
import Global from "./Global";
import { BarSpinner } from "./Spinners";
import AUTH from './utils/AUTH';
import CLIENT from './utils/CLIENT';
import CONTEXT from './utils/CONTEXT';
import ENV from './utils/ENV';
import FETCH from './utils/FETCH';
import SERVER from './utils/SERVER';
import TIME from './utils/TIME';

const Header = (props) => {

    let { environ } = useParams();
    let navigate = useNavigate();
    const [ header, setHeader ] = useContext(Global);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);

    let titleBackgroundColor = ENV.IsFoursightFourfront(header) ? "#14533C" : "#143C53";
    let subTitleBackgroundColor = ENV.IsFoursightFourfront(header) ? "#AEF1D6" : "#AED6F1";

    let titleToolTip = "Foursight";

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
                href={"https://" + header.app?.credentials.aws_account_number + ".signin.aws.amazon.com/console/"}>
                AWS <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span>
            </a>
        </span>
    }

    function initiateAppReload() {
        const url = SERVER.Url("/reloadlambda", false);
        FETCH.get(url);
    }

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
                    <a href={ENV.IsFoursightFourfront(header) ? ("https://" +  ENV.PublicName(ENV.Current(), header) + ".4dnucleome.org/") : "https://cgap.hms.harvard.edu/"} target="_blank">
                        { ENV.IsFoursightFourfront(header) ? (<span>
                            <img style={{marginLeft:"14px",marginTop:"5px",marginBottom:"5px"}} src="https://data.4dnucleome.org/static/img/favicon-fs.ico" height="32" width="44" />
                        </span>):(<span>
                            <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                        </span>)}
                    </a>
                </td>
                <td width="34%" align="center" style={{whiteSpace:"nowrap"}}>
                    <div style={{fontSize:"20pt",color:"white",cursor:"default"}}>
                        { header.app?.stage == 'dev' ? (<>
                            { header.app?.local ? (<>
                                <span title="Running locally." style={{position:"relative",bottom:"3pt",color:"yellow",fontSize:"17pt"}}>&#8861;</span>&nbsp;
                                <span title="Stage is DEV. Running locally" style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"26pt"}}>&#x269B;</span>&nbsp;&nbsp;
                                <span className="title-font" style={{position:"relative",bottom:"3pt",color:"white",fontWeight:"bold"}}>{header.page?.title.toUpperCase()}</span>&nbsp;&nbsp;
                                <span title="Stage is DEV. Running locally" style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"24pt"}}>&#x269B;</span>&nbsp;
                                <span title="Running locally." style={{position:"relative",bottom:"3pt",color:"yellow",fontSize:"17pt"}}>&#8861;</span>&nbsp;&nbsp;
                            </>):(<>
                                <span title="Stage is DEV." style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"24pt"}}>&#x269B;</span>&nbsp;&nbsp;
                                <span className="title-font" style={{position:"relative",bottom:"2pt",color:"white",fontWeight:"bold"}}>{header.page?.title.toUpperCase()}</span>&nbsp;&nbsp;
                                <span title="Stage is DEV." style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"24pt"}}>&#x269B;</span>&nbsp;
                            </>)}
                        </>):(<>
                            { header.app?.local ? (<>
                                <span title="Running locally." style={{position:"relative",bottom:"2pt",color:"yellow",fontSize:"17pt"}}>&#8861;</span>&nbsp;&nbsp;
                                <span className="title-font" style={{position:"relative",bottom:"1pt",color:"white",fontWeight:"bold"}}>{header.page?.title.toUpperCase()}</span>&nbsp;&nbsp;
                                <span title="Running locally." style={{position:"relative",bottom:"2pt",color:"yellow",fontSize:"17pt"}}>&#8861;</span>&nbsp;&nbsp;
                            </>):(<>
                                <span className="title-font" style={{position:"relative",bottom:"1pt",color:"white",fontWeight:"bold"}}>{header.page?.title.toUpperCase()}</span>&nbsp;&nbsp;
                            </>)}
                        </>)}
                    </div>
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
                        <a target="_blank" href={"https://pypi.org/project/" + (ENV.IsFoursightFourfront(header) ? "foursight" : "foursight-cgap") + "/" + header.app?.version + "/"}><b title="Version of: foursight-cgap" style={{textDecoration:"none",color:"#263A48"}}>{header.app?.version}</b></a>
                    </td>
                    <td width="49%" style={{paddingRight:"10pt",paddingTop:"2pt",paddingBottom:"1pt",whiteSpace:"nowrap"}} align="right" nowrap="1">
                        { (ENV.KnownEnvs(header).length > 0) ? (
                        <span className="dropdown">
                            <b className="dropdown-button" style={{color:!ENV.IsCurrentKnown(header) || !ENV.IsCurrentAllowed(header)  ? "red" : "#143c53"}} title={"Environment: " + ENV.Current() + (!ENV.IsCurrentKnown(header) ? " -> UNKNOWN" : "")}>{ENV.Current() || "unknown-env"}</b>
                            <div className="dropdown-content" id="dropdown-content-id" style={{background:subTitleBackgroundColor}}>
                                { ENV.KnownEnvs(header).map(env => 
                                    ENV.Equals(env, ENV.Current()) ?  (
                                        <span key={env.public_name}>{env.public_name}&nbsp;&nbsp;&#x2713;{ !ENV.IsAllowed(env, header) && <>&nbsp;&nbsp;&#x26A0;</>}</span>
                                    ):(<>
                                        { ENV.IsAllowed(env, header) ? (<>
                                            {/* This works "okay" 2022-09-18 but does not refresh/refetch (say) /users page data on select new env */}
                                            {/* <Link key={env.public_name} to={CLIENT.Path(null, env.public_name)}>{env.public_name}</Link> */}
                                            {/* So doing this funky double redirect to get it to ... TODO: figure out right/React of of doing this */}
                                            <Link key={env.public_name} to={{pathname: "/redirect"}} state={{url: !ENV.IsCurrentKnown(header) ? CLIENT.Path("/env", ENV.Default()) : CLIENT.Path(null, env.public_name)}}>{env.public_name}</Link>
                                        </>):(<>
                                            <Link key={env.public_name} to={CLIENT.Path("/env", env.public_name)}>{env.public_name}{ !ENV.IsAllowed(env, header) && <>&nbsp;&nbsp;&#x26A0;</>}</Link>
                                        </>)}
                                    </>)
                                )}
                                <div height="1" style={{marginTop:"2px",height:"1px",background:"darkblue"}}></div>
                                <Link id="__envinfo__" to={CLIENT.Path("/env")}onClick={()=>{document.getElementById("__envinfo__").style.fontWeight="bold";}}>Environments</Link>
                            </div>
                         </span>
                        ):(
                            <b style={{color:titleBackgroundColor}} title="Environment: {ENV.Current()}">{ENV.Current()}</b>
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
                        { (AUTH.IsLoggedIn(header)) ? (<>
                            { AUTH.LoggedInUser(header) ? (<>
                                <Link to={CLIENT.Path("/login")} style={{textDecoration:"none"}}><b title="" style={{color:"darkblue"}} title="Logged in as.">{AUTH.LoggedInUser(header)}</b></Link>
                            </>):(<>
                                { (AUTH.IsFauxLoggedIn()) ? (<>
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
                    <td style={{background:"lightyellow",color:"darkred",padding:"3pt"}} colSpan="2">
                        <i style={{fontSize:"small"}}>This is an <b>experimental</b> version of Foursight using <b>React</b>. For more info click <b><a href="https://hms-dbmi.atlassian.net/wiki/spaces/~627943f598eae500689dbdc7/pages/2882699270/Foursight+React" style={{color:"darkred"}} target="_blank"><u>here</u></a></b>.
                        To go to the real Foursight click <a href={ENV.LegacyFoursightLink(header)} style={{color:"inherit"}}><b><u>here</u></b></a>.</i>
                    </td>
                    <td style={{background:"lightyellow",color:"darkred",textAlign:"right",paddingRight:"10pt",fontSize:"small",fontStyle:"italic"}}>
                        { CLIENT.IsLocal() && <>
                            { SERVER.IsLocalCrossOrigin() ? (<>
                                Running locally cross-origin
                            </>):(<>
                                Running locally
                            </>)}
                        </>}
                    </td>
                </tr>
                <tr>
                    <td style={{height:"1px",background:"darkblue"}}></td>
                </tr>
            </tbody></table>
            </div>
            <div style={{float:"right",marginRight:"7pt",marginTop:"6pt"}}>
                { false && CLIENT.IsLocal() && (<>
                    <div style={{fontSize:"small",fontWeight:"bold",paddingTop:"2pt",paddingBottom:"2pt",paddingLeft:"5pt",paddingRight:"5pt",color:"#684B19",background:"#FCF8E3",border:"2px double #8A6D3B",borderRadius:"8px"}}>
                        <div>
                            { SERVER.IsLocalCrossOrigin() ? (<>
                                Running Locally (Cross-Origin)
                            </>):(<>
                                Running Locally
                            </>)}
                        </div>
                </div>
                </>)}
                <div>
                    {/* Could put some other branding here ... */}
                    {/* <img src="https://avatars.githubusercontent.com/u/23222469?s=200&v=4" height="60" /> */}
                </div>
            </div>
            </React.Fragment>)}
    </>
};

export default Header;
