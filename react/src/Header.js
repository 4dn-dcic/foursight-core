import React from 'react';
import { useContext } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import HeaderData from './HeaderData';
import { useHeaderRefresh } from './HeaderRefresh';
import { BarSpinner, StandardSpinner } from './Spinners';
import Auth from './utils/Auth';
import Char from './utils/Char';
import Client from './utils/Client';
import Context from './utils/Context';
import LiveTime from './LiveTime';
import Env from './utils/Env';
import Image from './utils/Image';
import Logout from './utils/Logout';
import Styles from './Styles';
import { ReadOnlyModeDisplay } from './ReadOnlyMode';
import { useFetching } from './utils/Fetch';
// import JustLoggedIn from './JustLoggedIn';
// Issues with serving images ONLY from 4dn-dcic/dev NOT from cgap-supertest ...
// So serve from my GitHub account for now ...
// import LockImage from './media/lock.jpg';
// import UnlockImage from './media/unlock.jpg';

const Header = (props) => {

    const [ header ] = useContext(HeaderData);
    const refreshHeader = useHeaderRefresh();
    //
    // Very odd but this below (navigate) declaration of useNavigate is REQUIRED, even if not
    // used here, in order for the header navigation links (e.g. HOME, INFO) to work properly.
    // If this is not here, for example, then the (target) values do not get updated properly
    // when on the EnvPage and clicking from one environment to another. No idea why.
    // Fun tracking this down.
    //
    const navigate = useNavigate();
    const [ fetching ] = useFetching();

    let titleBackgroundColor = Env.IsFoursightFourfront(header) ? "#14533C" : "#143C53";
    let subTitleBackgroundColor = Env.IsFoursightFourfront(header) ? "#AEF1D6" : "#AED6F1";

    function getTitleBackgroundColorWhileLoading() {
        if (Auth.IsLoggedIn(header)) {
            return titleBackgroundColor;
        }
        else {
            return "#444444";
        }
    }

    function renderNavigationLinks(header) {
        function style(isActive) {
            if (isActive) {
                return { textDecoration: "none", color: "black", fontWeight: "bold" }
            }
            else {
                return { textDecoration: "none", color: Styles.GetForegroundColor(), fontWeight: "normal" }
            }
        }
        return <span>
            <NavLink to={Client.Path("/home")} style={({isActive}) => style(isActive)}>HOME</NavLink>&nbsp;|&nbsp;
            <NavLink to={Client.Path("/env")} style={({isActive}) => style(isActive)}>ENV</NavLink>&nbsp;|&nbsp;
            <NavLink to={Client.Path("/info")} style={({isActive}) => style(isActive)}>INFO</NavLink>&nbsp;|&nbsp;
            <NavLink to={Client.Path("/checks")} style={({isActive}) => style(isActive)}>CHECKS</NavLink>&nbsp;|&nbsp;
            <NavLink to={Client.Path("/users")} style={({isActive}) => style(isActive)}>USERS</NavLink>&nbsp;|&nbsp;
            {/* TODO: portal link does not change appropriately e.g. for 4dn-dcic when choosing from data to mastertest in dropdown */}
            <a target="_blank" rel="noreferrer" title="Open portal in another tab."
                style={{textDecoration:"none",color:"darkgreen"}}
                href={Client.PortalLink(header)}>
                PORTAL <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span>
            </a>&nbsp;|&nbsp;
            <a target="_blank" rel="noreferrer" title="Open AWS Console for this account ({header.app?.credentials.aws_account_number}) in another tab."
                style={{textDecoration:"none",color:"darkgreen"}}
                href={"https://" + header.app?.credentials.aws_account_number + ".signin.aws.amazon.com/console/"}>
                AWS <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span>
            </a>
        </span>
    }

    return <>
        { header.loading ? (
            <div style={{width:"100%"}}>
            <table style={{width:"100%",height:"42px",background:getTitleBackgroundColorWhileLoading()}}><tbody>
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
            {/* TODO: Refactor to center the title in the main header more reliably no matter how long the left and right parts are */}
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
            <tr title={"App Deployed:" + header.app?.deployed + " | App Launched: " + header.app?.launched + " | Page Loaded: " + header.page?.loaded}>
                <td width="38%" style={{paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href={Client.PortalLink(header)} target="_blank" rel="noreferrer">
                        { Env.IsFoursightFourfront(header) ? (<span>
                            <img alt="foursight" style={{marginLeft:"14px",marginTop:"5px",marginBottom:"5px"}} src={Image.FoursightFourfrontLogo()} height="32" width="44" />
                        </span>):(<span>
                            <img alt="foursight" src={Image.FoursightCgapLogo()} width="130" />
                        </span>)}
                    </a>
                </td>
                <td width="24%" align="center" style={{whiteSpace:"nowrap"}}>
                    <div style={{fontSize:"20pt",color:"white",cursor:"pointer"}} onClick={() => navigate(Client.Path("/login"))}>
                        { header.app?.stage === 'dev' ? (<>
                            { header.app?.local ? (<>
                                <span title="Running locally." style={{position:"relative",bottom:"3pt",color:"yellow",fontSize:"17pt"}}>{Char.DoNotEnter}</span>&nbsp;
                                <span title="Stage is DEV. Running locally" style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"26pt"}}>{Char.Atom}</span>&nbsp;&nbsp;
                                <span className="title-font" style={{position:"relative",bottom:"3pt",color:"white",fontWeight:"bold"}}>{header.app?.title.toUpperCase()}</span>&nbsp;&nbsp;
                                <span title="Stage is DEV. Running locally" style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"24pt"}}>{Char.Atom}</span>&nbsp;
                                <span title="Running locally." style={{position:"relative",bottom:"3pt",color:"yellow",fontSize:"17pt"}}>{Char.DoNotEnter}</span>&nbsp;&nbsp;
                            </>):(<>
                                <span title="Stage is DEV." style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"24pt"}}>{Char.Atom}</span>&nbsp;&nbsp;
                                <span className="title-font" style={{position:"relative",bottom:"2pt",color:"white",fontWeight:"bold"}}>{header.app?.title.toUpperCase()}</span>&nbsp;&nbsp;
                                <span title="Stage is DEV." style={{position:"relative",bottom:"1pt",color:"yellow",fontSize:"24pt"}}>{Char.Atom}</span>&nbsp;
                            </>)}
                        </>):(<>
                            { header.app?.local ? (<>
                                <span title="Running locally." style={{position:"relative",bottom:"2pt",color:"yellow",fontSize:"17pt"}}>{Char.DoNotEnter}</span>&nbsp;&nbsp;
                                <span className="title-font" style={{position:"relative",bottom:"1pt",color:"white",fontWeight:"bold"}}>{header.app?.title.toUpperCase()}</span>&nbsp;&nbsp;
                                <span title="Running locally." style={{position:"relative",bottom:"2pt",color:"yellow",fontSize:"17pt"}}>{Char.DoNotEnter}</span>&nbsp;&nbsp;
                            </>):(<>
                                <span className="title-font" style={{position:"relative",bottom:"1pt",color:"white",fontWeight:"bold"}}>{header.app?.title.toUpperCase()}</span>&nbsp;&nbsp;
                            </>)}
                        </>)}
                    </div>
                </td>
                <td width="38%" style={{paddingRight:"10pt",whiteSpace:"nowrap",color:"#D6EAF8"}} align="right">
                    <small><LiveTime.FormatDateTime verbose={true} timezone={false} /></small>
                    { (header.app?.credentials?.aws_account_name) && <>
                        &nbsp;|&nbsp;<Link to={Client.Path("/login")} style={{textDecoration:"none",color:"inherit"}}><b title={`AWS Account Number: ${header.app?.credentials?.aws_account_number}`}>{header.app?.credentials?.aws_account_name?.replace(/^cgap-/, "")}</b></Link>
                    </>}
                    { (Auth.IsLoggedIn(header)) ? (<span>
                        &nbsp;|&nbsp;<span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => Logout()}>LOGOUT</span>
                    </span>):(<span>
                        &nbsp;|&nbsp;<Link to={Client.Path("/login?auth", Env.Current(header))} style={{cursor:"pointer",color:"#D6EAF8"}} title="Not logged in. Click to login.">LOGIN</Link>
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
                        <a target="_blank" rel="noreferrer" href={"https://pypi.org/project/" + (Env.IsFoursightFourfront(header) ? "foursight" : "foursight-cgap") + "/" + header.app?.version + "/"}><b title="Version of: foursight-cgap" style={{textDecoration:"none",color:"#263A48",paddingRight:"8pt"}}>{header.app?.version}</b></a>
                    </td>
                    <td width="49%" style={{paddingRight:"10pt",paddingTop:"2pt",paddingBottom:"1pt",whiteSpace:"nowrap"}} align="right" nowrap="1">
                        { (Env.KnownEnvs(header).length > 0) ? (
                        <span className="dropdown">
                            <b className="dropdown-button" style={{color:(!Env.IsKnown(Env.Current(), header) || (Auth.IsLoggedIn(header) && !Env.IsAllowed(Env.Current(), header))) ? "red" : "#143c53"}} title={"Environment: " + Env.Current() + (!Env.IsKnown(Env.Current(), header) ? " -> UNKNOWN" : "")}>{Env.Current() || "unknown-env"}</b>
                            <div className="dropdown-content" id="dropdown-content-id" style={{background:subTitleBackgroundColor}}>
                                { Env.KnownEnvs(header).map(env => 
                                    Env.Equals(env, Env.Current()) ?
                                        <span key={env.full_name}>{Env.PreferredName(env, header)}&nbsp;&nbsp;{Char.Check}{ !Env.IsAllowed(env, header) && Auth.IsLoggedIn(header) && <>&nbsp;&nbsp;{Char.Warning}</>}</span>
                                    :
                                        Env.IsAllowed(env, header) ?
                                            // This works "okay" 2022-09-18 but does not refresh/refetch (say) /users page data on select new env
                                            // <Link key={env.public_name} to={Client.Path(null, env.public_name)}>{env.public_name}</Link>
                                            // So doing this funky double redirect to get it to ... TODO: figure out right/React of of doing this
                                            <Link onClick={() => refreshHeader(Env.PreferredName(env))} key={env.full_name} to={{pathname: "/redirect"}} state={{url: !Env.IsKnown(Env.Current(), header) ? Client.Path("/env", Env.PreferredName(Env.Default(header), header)) : Client.Path(null, Env.PreferredName(env, header))}}>{Env.PreferredName(env, header)}</Link>
                                        :
                                            <Link key={env.public_name} to={Client.Path("/env", Env.PreferredName(env, header))}>{Env.PreferredName(env, header)}{!Env.IsAllowed(env, header) && Auth.IsLoggedIn(header) && <>&nbsp;&nbsp;{Char.Warning}</>}</Link>
                                )}
                                <div height="1" style={{marginTop:"2px",height:"1px",background:"darkblue"}}></div>
                                { Auth.IsLoggedIn(header) && (header.app?.accounts_file || header.app?.accounts_file_from_s3) && <Link id="__accounts__" to={Client.Path("/accounts")}onClick={()=>{document.getElementById("__accounts__").style.fontWeight="normal";}}>Accounts</Link> }
                                <Link id="__envinfo__" to={Client.Path("/env")}onClick={()=>{document.getElementById("__envinfo__").style.fontWeight="normal";}}>Environments</Link>
                                { Auth.IsLoggedIn(header) && <Link id="__session__" to={Client.Path("/login")}onClick={()=>{document.getElementById("__session__").style.fontWeight="normal";}}>Session</Link> }
                            </div>
                         </span>
                        ):(
                            <b style={{color:titleBackgroundColor}} title="Environment: {Env.Current()}">{Env.Current()}</b>
                        )}
                        &nbsp;|&nbsp;
                        { (header.app?.stage === 'prod') ? (<>
                            <b title="Deployment stage: PROD!" style={{color:"darkred"}}>{header.app?.stage}</b> &nbsp;|&nbsp;
                        </>):(<></>)}
                        { (header.app?.stage === 'dev') ? (<>
                            <b title="Deployment stage: DEV" style={{color:"darkgreen"}}>{header.app?.stage}</b> &nbsp;|&nbsp;
                        </>):(<></>)}
                        { (header.app?.stage !== 'prod' && header.app?.stage !== 'dev') ? (<>
                            <b title="Deployment stage: {header.app?.stage}">{header.app?.stage}}</b> &nbsp;|&nbsp;
                        </>):(<></>)}
                        { (Auth.IsLoggedIn(header)) ? (<>
                            { Auth.LoggedInUser(header) ? (<>
                                <Link to={Client.Path("/login")} style={{textDecoration:"none"}}><b style={{color:"darkblue"}} title="Logged in as.">{Auth.LoggedInUser(header)}</b></Link>
                                { Auth.LoggedInViaGoogle(header) ? <>
                                    <img alt="google" title="Google Authentication" style={{marginLeft:"9px",marginRight:"0",marginBottom:"2px"}} src={Image.GoogleLoginLogo()} height="15" />
                                </>:<>
                                    { Auth.LoggedInViaGitHub(header) && <>
                                        <img alt="github" title="GitHub Authentication" style={{marginLeft:"5px",marginRight:"-4px",marginBottom:"2px"}} src={Image.GitHubLoginLogo()} height="19" />
                                    </>}
                                </>}
                            </>):(<>
                                <span className={"tool-tip"} data-text="Running locally and unknown user logged in.">
                                    <b style={{color:"darkred"}}>UNKNOWN USER</b>
                                </span>
                            </>)}
                        </>):(<>
                            <Link to={Client.Path("/login", Env.Current(header))} style={{textDecoration:"none"}}><b style={{color:"darkblue"}}>NOT LOGGED IN</b></Link>
                        </>)}
                    </td>
                </tr>
                <tr>
                    <td style={{background:"lightyellow",color:"darkred",padding:"3pt"}} colSpan="1">
                        <i style={{fontSize:"small"}}>This is the <b>new</b> Foursight <b>React</b>.
                        For the <b>legacy</b> Foursight click <a href={Env.LegacyFoursightLink(header)} style={{color:"inherit"}}><b><u>here</u></b></a>.</i>
                    </td>
                    <td style={{background:"lightyellow"}}>
                        {/* <BarSpinner loading={header.contentLoading} color="darkred" size="160"/> */}
                    </td>
                    <td style={{background:"lightyellow",color:"darkred",fontSize:"small"}}>
                        <table width="100%"><tbody><tr>
                        <td style={{float:"right",width:"98%",whiteSpace:"nowrap",align:"right"}} align="right">
                            { fetching.length > 0 && <>
                                <span><StandardSpinner loading={fetching.length > 0} color={'darkred'} label="" size={150} style={{marginRight:"20px"}} /></span>
                            </>}
                        </td>
                        <td style={{width:"1%",color:"darkred"}}>
                            {fetching.length > 0 && <small>&nbsp;&nbsp;[{fetching.length}]</small>}
                        </td>
                        <td style={{color:"darkred",textAlign:"right",paddingRight:"10pt",width:"1%",fontSize:"small",fontStyle:"italic",whiteSpace:"nowrap"}}>
                            { Client.IsLocal() && <>
                                &nbsp;&nbsp;
                                { Context.IsLocalCrossOrigin() ? (<>
                                    Running locally cross-origin
                                </>):(<>
                                    Running locally
                                </>)}
                            </>}
                        </td>
                        </tr></tbody></table>
                    </td>
                </tr>
                <tr>
                    <td style={{height:"1px",background:"darkblue"}}></td>
                </tr>
            </tbody></table>
            </div>
            <div style={{float:"right",marginRight:"7pt",marginTop:"6pt"}}>
                { false && Client.IsLocal() && (<>
                    <div style={{fontSize:"small",fontWeight:"bold",paddingTop:"2pt",paddingBottom:"2pt",paddingLeft:"5pt",paddingRight:"5pt",color:"#684B19",background:"#FCF8E3",border:"2px double #8A6D3B",borderRadius:"8px"}}>
                        <div>
                            { Context.IsLocalCrossOrigin() ? (<>
                                Running Locally (Cross-Origin)
                            </>):(<>
                                Running Locally
                            </>)}
                        </div>
                </div>
                </>)}
                <div>
                    <table><tbody><tr>
                        {/* <td style={{}}><JustLoggedIn /></td> */}
                        <td style={{paddingLeft:"10pt"}}><ReadOnlyModeDisplay /></td>
                    </tr></tbody></table>
                </div>
            </div>
            </React.Fragment>)}
    </>
};

export default Header;
