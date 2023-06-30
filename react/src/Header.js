import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import useHeader from './hooks/Header';
import useHeaderRefresh from './hooks/HeaderRefresh';
import { BarSpinner, StandardSpinner } from './Spinners';
import Auth from './utils/Auth';
import Char from './utils/Char';
import Client from './utils/Client';
import Context from './utils/Context';
import LiveTime from './LiveTime';
import Time from './utils/Time';
import Env from './utils/Env';
import Image from './utils/Image';
import Logout from './utils/Logout';
import Styles from './Styles';
import Tooltip from './components/Tooltip';
import ReadOnlyModeComponent from './hooks/ReadOnlyModeComponent';
import useFetching from './hooks/Fetching';
import useFetch from './hooks/Fetch';

const Warnings = ({ header }) => {
    return <>
        <PortalSslCertificateWarning header={header} />
        <PortalAccessKeyWarning header={header} />
    </>
}

const PortalSslCertificateWarning = () => {
    const [ args ] = useSearchParams();
    const sslCertificateInfo = useFetch(`/certificates`);
    if (sslCertificateInfo.loading) return <></>
    const sslCertificateInfoPortal = sslCertificateInfo.find(certificate => certificate.name === "Portal");
    if (sslCertificateInfoPortal && sslCertificateInfoPortal.expires_soon) {
        return <WarningBar>
            <b>Warning: SSL certificate for associated Portal will expire soon</b>
            &nbsp;{Char.RightArrow}&nbsp; {sslCertificateInfoPortal.expires_at} &nbsp;{Char.RightArrow}&nbsp;
            {Time.FromNow(sslCertificateInfoPortal.expires_at, true, false)}
            &nbsp;{Char.RightArrow}&nbsp;
            <Link to={Client.Path("/certificates")} style={{color:"inherit"}}>View</Link>
        </WarningBar>
    }
}

const PortalAccessKeyWarning = ({ header }) => {
    const portalAccessKeyInfo = useFetch(`/portal_access_key`);
    if (portalAccessKeyInfo.loading) return <></>
    if (portalAccessKeyInfo) {
        if (portalAccessKeyInfo?.data?.expires_soon) {
            return <WarningBar>
                <b>Warning: Access key for associated Portal will expire soon</b>
                &nbsp;{Char.RightArrow}&nbsp; {portalAccessKeyInfo.data.expires_at} &nbsp;{Char.RightArrow}&nbsp;
                {Time.FromNow(portalAccessKeyInfo.data.expires_at, true, false)}
                &nbsp;{Char.RightArrow}&nbsp;
                <Link to={Client.Path("/portal_access_key")} style={{color:"inherit"}}>View</Link>
            </WarningBar>
        } else if (portalAccessKeyInfo.data?.invalid) {
            return <WarningBar>
                <Tooltip id="alert-access-key-invalid" position="bottom" text={`Portal access key: ${portalAccessKeyInfo.data.key}`} />
                <b>Alert: <span id="alert-access-key-invalid">Access key</span> for associated Portal {portalAccessKeyInfo.data.expired ? 'has expired' : (portalAccessKeyInfo.data.probably_expired ? 'has probably expired' : 'is invalid')}</b>
                &nbsp;{Char.RightArrow}&nbsp;
                <Link to={Client.Path("/portal_access_key")} style={{color:"inherit"}}>View</Link>
            </WarningBar>
        }
    }
}

const WarningBar = ({ children }) => {
    return <>
        <tr><td style={{background:"black",height:"2px"}} colSpan="3"></td></tr>
        <tr>
            <td style={{background:"darkred",color:"#FFF4F3",padding:"3pt",fontSize:"9pt"}} colSpan="3">
                {children}
            </td>
        </tr>
        <tr><td style={{background:"black",height:"1px"}} colSpan="3"></td></tr>
    </>
}

const MainMenu = ({ header }) => {

    let subTitleBackgroundColor = Styles.LightenDarkenColor(Styles.GetBackgroundColor(), -10);

    const MenuItem = ({ path, label }) => {
        return <>
            {(Client.CurrentLogicalPath() === path) ? <span style={{fontWeight:"bold"}}>{label}&nbsp;{Char.Check}</span> : <Link key={path} to={Client.Path(path)}>{label}</Link>}
        </>
    }
    const MenuSeparator = () => {
        return <div style={{height:"1px",marginTop:"1pt",marginBottom:"1pt",marginLeft:"6pt",marginRight:"6pt",background:"var(--box-fg)"}} />
    }

    return <>
        <span className="dropdown">
            <span className="dropdown-button"><img alt="menu" style={{marginLeft:"-4px",marginTop:"-1px"}} src={Image.MenuIcon()} height="20"/></span>
            <div className="dropdown-content" id="dropdown-content-id" style={{background:subTitleBackgroundColor}}>
                <MenuItem path="/home" label="Home" />
                <MenuItem path="/info" label="General Info" />
                <MenuItem path="/checks" label="Checks" />
                <MenuSeparator />
                <MenuItem path="/aws/infrastructure" label="Infrastructure" />
                <MenuItem path="/aws/s3" label="S3" />
                <MenuItem path="/users" label="Users" />
                <MenuSeparator />
                <MenuItem path="/env" label="Environments" />
                {/* The all=true arg to /accounts means show all known accounts not just onece related to the current account */}
                <MenuItem path="/accounts?all=true" label="Accounts" />
                <MenuItem path="/login" label={Auth.IsLoggedIn(header) ? "Session" : "Login"} />
            </div>
        </span>
    </>
}

const NavLinks = ({ header }) => {
    function style(isActive) {
        if (isActive) {
            return { textDecoration: "none", color: "black", fontWeight: "bold" }
        }
        else {
            return { textDecoration: "none", color: Styles.GetForegroundColor(), fontWeight: "normal" }
        }
    }
    return <>
        <NavLink to={Client.Path("/home")} style={({isActive}) => style(isActive)}>HOME</NavLink>&nbsp;|&nbsp;
        <NavLink to={Client.Path("/info")} style={({isActive}) => style(isActive)}>INFO</NavLink>&nbsp;|&nbsp;
        <NavLink to={Client.Path("/checks")} style={({isActive}) => style(isActive)}>CHECKS</NavLink>&nbsp;|&nbsp;
        <NavLink to={Client.Path("/env")} style={({isActive}) => style(isActive)}>ENV</NavLink>&nbsp;|&nbsp;
        {/* TODO: portal link does not change appropriately e.g. for 4dn-dcic when choosing from data to mastertest in dropdown */}
        <a target="_blank" rel="noreferrer" id="tooltip-header-portal"
            style={{textDecoration:"none",color:"darkgreen"}}
            href={Client.PortalLink(header)}>
            PORTAL <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span>
        </a>&nbsp;|&nbsp;
        <a target="_blank" rel="noreferrer" id="tooltip-header-aws"
            style={{textDecoration:"none",color:"darkgreen"}}
            href={"https://" + header.app?.credentials.aws_account_number + ".signin.aws.amazon.com/console/"}>
            AWS <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span>
        </a>
        <Tooltip id="tooltip-header-portal" position="bottom" text={`Open portal (in new tab).`} />
        <Tooltip id="tooltip-header-aws" position="bottom" text={`Open AWS console for (${header.app?.credentials.aws_account_name ? header.app?.credentials.aws_account_name + "/" : ""}${header.app?.credentials.aws_account_number}) account (in new tab).`} />
    </>
}

const Nav = ({ header }) => {
    return <span>
        <MainMenu header={header} />
        <>&nbsp;|&nbsp;</>
        <NavLinks header={header} />
    </span>
}

const Header = (props) => {

    const header = useHeader();
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
    let subTitleBackgroundColor = Styles.LightenDarkenColor(Styles.GetBackgroundColor(), -10);

    function getTitleBackgroundColorWhileLoading() {
        if (Auth.IsLoggedIn(header)) {
            return titleBackgroundColor;
        }
        else {
            return "#444444";
        }
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
            <tr>
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
                    <div style={{fontSize:"20pt",color:"white",cursor:"pointer"}} onClick={() => navigate(Client.Path("/home"))}>
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
                        &nbsp;|&nbsp;<Link id="tooltip-header-account" to={Client.Path("/login")} style={{textDecoration:"none",color:"inherit"}}><b>{header.app?.credentials?.aws_account_name?.replace(/^cgap-/, "")}</b></Link>
                        <Tooltip id="tooltip-header-account" position="bottom" text={`AWS account number: ${header.app?.credentials?.aws_account_number}`} />
                    </>}
                    { (Auth.IsLoggedIn(header)) ? (<span>
                        &nbsp;|&nbsp;<span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => Logout()}>LOGOUT</span>
                    </span>):(<span>
                        &nbsp;|&nbsp;<Link to={Client.Path("/login?auth", Env.Current(header))} style={{cursor:"pointer",color:"#D6EAF8"}} id="tooltip-header-nologin">LOGIN</Link>
                        <Tooltip id="tooltip-header-nologin" position="bottom" text="Not logged in. Click to login." />
                    </span>)}
                </td>
            </tr>
            </tbody></table>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
                <tr style={{background:subTitleBackgroundColor}}>
                    <td width="49%" style={{paddingLeft:"10pt",paddingTop:"3pt",paddingBottom:"3pt",whiteSpace:"nowrap"}}>
                        <Nav header={header} />
                    </td>
                    <td width="2%" align="center" style={{whiteSpace:"nowrap",margin:"0 auto"}}>
                        <a target="_blank" rel="noreferrer" href={"https://pypi.org/project/" + (Env.IsFoursightFourfront(header) ? "foursight" : "foursight-cgap") + "/" + header.app?.version + "/"}>
                            <b style={{textDecoration:"none",color:"#263A48",paddingRight:"8pt"}} id="tooltip-header-version">{header.app?.version}</b>
                            <Tooltip id="tooltip-header-version" position="bottom" text={(header.app?.deployed ? `Deployed: ${header.app?.deployed}. ` : "") + "Launched: " + header.app?.launched} size="x-small" />
                        </a>
                    </td>
                    <td width="49%" style={{paddingRight:"10pt",paddingTop:"2pt",paddingBottom:"1pt",whiteSpace:"nowrap"}} align="right" nowrap="1">
                        { ((Env.Current() !== "cognito") && (Env.KnownEnvs(header).length > 0)) ? <>
                        <span className="dropdown">
                            <Tooltip id="tooltip-header-env" position="left" size={"small"} text={`Environments`} shape="squared" nopad={true} />
                            <b id="tooltip-header-env" className="dropdown-button" style={{color:(!Env.IsKnown(Env.Current(), header) || (Auth.IsLoggedIn(header) && !Env.IsAllowed(Env.Current(), header))) ? "red" : "#143c53"}}>{Env.Current() || "unknown-env"}</b>
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
                                <Link id="__envinfo__" to={Client.Path("/env")}onClick={()=>{document.getElementById("__envinfo__").style.fontWeight="normal";}}>Environments</Link>
                            </div>
                         </span>
                         &nbsp;|&nbsp;
                        </>:<>
                            { (Env.Current() !== "cognito") ? <>
                                <b style={{color:titleBackgroundColor}}>{Env.Current()}</b>
                                &nbsp;|&nbsp;
                            </>:<>
                                <b style={{color:titleBackgroundColor}}>{Env.PreferredName(Env.Default(header))}</b>
                            </> }
                        </> }
                        { (header.app?.stage === 'prod') ? (<>
                            <b id="tooltip-header-stage-prod" style={{color:"darkred"}}>{header.app?.stage}</b> &nbsp;|&nbsp;
                            <Tooltip id="tooltip-header-stage-prod" position="bottom" text={`Deployment stage: PROD`} />
                        </>):(<></>)}
                        { (header.app?.stage === 'dev') ? (<>
                            <b id="tooltip-header-stage-dev" style={{color:"darkgreen"}}>{header.app?.stage}</b> &nbsp;|&nbsp;
                            <Tooltip id="tooltip-header-stage-dev" position="bottom" text={`Deployment stage: DEV`} />
                        </>):(<></>)}
                        { (header.app?.stage !== 'prod' && header.app?.stage !== 'dev') ? (<>
                            <b id="tooltip-header-stage">{header.app?.stage}}</b> &nbsp;|&nbsp;
                            <Tooltip id="tooltip-header-stage" position="bottom" text={`Deployment stage: {header.app?.stage}`} />
                        </>):(<></>)}
                        { (Auth.IsLoggedIn(header)) ? (<>
                            { Auth.LoggedInUser(header) ? (<>
                                <Link to={Client.Path("/login")} id="tooltip-header-logged-in" style={{textDecoration:"none"}}><b style={{color:"darkblue"}}>{Auth.LoggedInUser(header)}</b></Link>
                                <Tooltip id="tooltip-header-logged-in" position="bottom" text={`Logged in ${Time.Ago(Auth.LoggedInAt())}`} />
                                { Auth.LoggedInViaGoogle(header) ? <>
                                    <span>
                                        <img id="tooltip-header-login-google" alt="google" style={{marginLeft:"9px",marginRight:"0",marginBottom:"2px"}} src={Image.GoogleLoginLogo()} height="15" />
                                        <Tooltip id="tooltip-header-login-google" position="bottom" text="Logged in via Google authentication." />
                                    </span>
                                </>:<>
                                    { Auth.LoggedInViaGitHub(header) && <>
                                        <span id="tooltip-header-login-github">
                                        <img alt="github" style={{marginLeft:"5px",marginRight:"-4px",marginBottom:"2px"}} src={Image.GitHubLoginLogo()} height="19" />
                                        </span>
                                        <Tooltip id="tooltip-header-login-github" position="bottom" text="Logged in via GitHub authentication." />
                                    </>}
                                </>}
                            </>):(<>
                                <b style={{color:"darkred"}}>UNKNOWN USER</b>
                            </>)}
                        </>):(<>
                            <Link to={Client.Path("/login", Env.Current(header))} style={{textDecoration:"none"}}><b style={{color:"darkblue"}} id="tooltip-header-nologin-2">NOT LOGGED IN</b></Link>
                            <Tooltip id="tooltip-header-nologin-2" position="bottom" text="Not logged in. Click to login." />
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
                <Warnings header={header} />
                <tr><td style={{height:"1px",background:"darkblue"}}></td></tr>
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
                        <td style={{paddingLeft:"10pt"}}><ReadOnlyModeComponent /></td>
                    </tr></tbody></table>
                </div>
            </div>
            </React.Fragment>)}
    </>
};

export default Header;
