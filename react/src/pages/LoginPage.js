import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useContext, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Global from '../Global';
import Auth0Lock from 'auth0-lock';
import Auth from '../utils/Auth';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import Context from '../utils/Context';
import Cookie from '../utils/Cookie';
import Env from '../utils/Env';
import Image from '../utils/Image';
import Json from '../utils/Json';
import LiveTime from '../LiveTime';
import Logout from '../utils/Logout';
import Yaml from '../utils/Yaml';
import Page from '../Page';

const LoginPage = (props) => {

    const [ header ] = useContext(Global);
    const [ showingAuthBox, setShowingAuthBox ] = useState(false);
    let [ showingAuthToken, setShowAuthToken ] = useState(false);
    const [args] = useSearchParams();
    const showAuthBoxAtOutset = args.get("auth")?.length >= 0;

    function login() {
        showAuthBox();
    }

    function showAuthBox() {
        document.getElementById("login_container").style.display = "none";
        document.getElementById("login_auth_container").style.display = "block";
        document.getElementById("login_auth_cancel").style.display = "block";
        Cookie.SetRedirect(Page.LastUrl());
        createAuth0Lock().show();
        //
        // Hacking styles for (now) embeded (rather than popup) Auth0 login box.
        //
        const isFirefoxBrowser = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
        if (isFirefoxBrowser) {
            // Firefox doesn't respect the fit-content on height so just disable the border entirely.
            document.getElementById("login_auth_container").style.height = "200";
            document.getElementById("login_auth_container").style.background = "white";
            document.getElementById("login_auth_container").style.borderStyle = "none";
        }
        document.getElementById("login_auth_container").firstChild.firstChild.style.paddingLeft = "1";
        document.getElementById("login_auth_container").firstChild.firstChild.style.paddingRight = "1";
        document.getElementById("login_auth_container").firstChild.firstChild.style.paddingTop = "1";
        document.getElementById("login_auth_container").firstChild.firstChild.style.paddingBottom = "1";
        document.getElementById("login_auth_container").firstChild.firstChild.style.fontWeight = "bold";
        document.getElementById("login_auth_container").firstChild.firstChild.style.fontWeight = "bold";
        setShowingAuthBox(true);
    }

    function createAuth0Lock() {
        const loginCallback = Context.Auth0.CallbackUrl();
        const loginClientId = Context.Auth0.CallbackId(header);
        const loginPayload = {
            container: "login_auth_container",
            auth: {
                redirectUrl: loginCallback,
                responseType: "code",
                sso: false,
                params: { scope: "openid email react", prompt: "select_account" }
            },
            socialButtonStyle: "big",
            languageDictionary: { title: "Foursight Login" },
            theme: {
                primaryColor: "blue",
                backgroundColor: "blue",
                logo: "",
            },
            allowedConnections: [ "google-oauth2", "github" ]
        };
        return new Auth0Lock(loginClientId, "hms-dbmi.auth0.com", loginPayload);
    }

    if (header.loading && !header.error) return <>Loading ...</>
    if (header.error) return <>Cannot load Foursight.</>
    return <>
        { Auth.IsLoggedIn(header) ? (<React.Fragment>
            <div className="container" style={{width:"40%"}}>
                {Auth.LoggedInUserName(header) && <b style={{marginLeft:"4pt",color:"darkblue"}}>Hello, {Auth.LoggedInUserName(header)} ...</b>}
                <div style={{float:"right",marginRight:"8pt",color:"darkblue",fontSize:"small",cursor:"pointer"}}>
                    { showingAuthToken ? <>
                        <span onClick={() => setShowAuthToken(false)}>Auth &#x2193;</span>
                    </>:<>
                        <span onClick={() => setShowAuthToken(true)}>Auth &#x2191;</span>
                    </>}
                </div>
                <div className="boxstyle info" style={{marginLeft:"0pt",padding:"10pt",color:"darkblue"}}>
                    <table style={{color:"inherit"}}><tbody><tr>
                        <td align="top" style={{whiteSpace:"nowrap"}}>
                            Logged in as:&nbsp;
                            <Link to={Client.Path("/users/" + Auth.LoggedInUser(header))}><b style={{color:"darkblue"}}>{Auth.LoggedInUser(header)}</b></Link> <br />
                            <div style={{fontSize:"small",marginTop:"6pt",paddingTop:"5pt",borderTop:"1px solid"}}>
                                Session started: <LiveTime.FormatDuration start={Auth.Token().authenticated_at} verbose={true} fallback={"just now"} suffix={"ago"} tooltip={true} />&nbsp;
                                <br />
                                Session expires: <LiveTime.FormatDuration end={Auth.Token().authenticated_until} verbose={true} fallback={"now"} suffix={"from now"} tooltip={true} />&nbsp;
                                <br />
                                Click <span style={{color:"darkblue",textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}}
                                    onClick={()=> Logout()}>here</span> to <span style={{cursor:"pointer",color:"darkblue"}} onClick={()=> Logout()}>logout</span>.
                            </div>
                        </td>
                        <td style={{width:"8pt"}}></td>
                        <td style={{background:"darkblue",width:"2px"}}></td>
                        <td style={{width:"8pt"}}></td>
                        <td style={{textAlign:"top",verticalAlign:"top"}}><small style={{marginTop:"20pt"}}>
                            { Env.Current() && <>
                                Current environment: <Link to={Client.Path("/env", Env.PreferredName(Env.Current(), header))} style={{color:"inherit"}}><b>{Env.PreferredName(Env.Current(), header)}</b></Link> <br />
                            </>}
                            { header?.auth?.initial_env && <>
                                Initial environment: <Link to={Client.Path("/env", Env.PreferredName(header.auth.initial_env, header))} style={{color:"inherit"}}><b>{Env.PreferredName(header.auth.initial_env, header)}</b></Link> <br />
                            </>}
                            { header?.auth?.known_envs && <>
                                Available environments: {header.auth.known_envs.map((env, index) => { return <span key={index}>{index > 0 && <>, </>}<b>{Env.PreferredName(env, header)}</b></span>})} <br />
                            </>}
                            {(header?.app?.credentials?.aws_account_number) && <>
                                AWS Account: {header?.app?.credentials?.aws_account_number} <br />
                            </>}
                        </small></td>
                    </tr></tbody></table>
                </div>
                { !Env.IsCurrentAllowed(header) && <>
                    <div className="boxstyle check-warn" style={{marginTop:"2pt",padding:"9pt",color:"darkred"}}>
                        Note that though you are logged in, you do not have permission to access the currently selected environment: <b style={{color:"red"}}>{Env.Current()}</b> <br />
                        <small>Click <Link to={Client.Path("/env")} style={{color:"darkred"}}><b><u>here</u></b></Link> to go the the <Link to={Client.Path("/env")} style={{color:"darkred"}}><b>Environments Page</b></Link> to select another environment.</small>
                    </div>
                </>}
                { showingAuthToken && <>
                    <div className="boxstyle info" style={{paddingLeft:"8pt",color:"darkblue",fontSize:"small"}}>
                        <span onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer",color:"darkblue"}}><b>AuthToken</b> from Cookie</span>
                        <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkblue",fontWeight:"bold",marginTop:"6pt"}}>
                            <span style={{fontSize:"0",opacity:"0"}} id={"authtoken"}>{Json.Str(Auth.Token())}</span>
                            <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken")} style={{float:"right",height:"20px",cursor:"copy"}} />
                            {Yaml.Format(Auth.Token())}
                        </pre>
                        <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkblue",fontWeight:"bold",marginTop:"-3pt",whiteSpace:"break-spaces"}}>
                            <span style={{fontSize:"0",opacity:"0"}} id={"auth"}>{Cookie.AuthTokenRaw()}</span>
                            <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("auth")} style={{float:"right",height:"20px",cursor:"copy"}} />
                            {Cookie.AuthTokenRaw()}
                        </pre>
                    </div>
                    { (Json.Str(Auth.Token()) !== Json.Str(header?.auth)) &&
                        <div className="boxstyle info" style={{paddingLeft:"8pt",color:"darkblue",fontSize:"small"}}>
                            <span onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer",color:"darkblue"}}><b>Auth</b> from API</span>
                            <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkblue",fontWeight:"bold",marginTop:"6pt"}}>{Yaml.Format(header?.auth)}</pre>
                        </div>
                    }
                </>}
            </div>
        </React.Fragment>):(<React.Fragment>
        <div className="container" id="login_container">
            <div style={{float:"right",marginRight:"94pt",color:"darkred",fontSize:"small",cursor:"pointer"}}>
                { showingAuthToken ? <>
                    <span onClick={() => setShowAuthToken(false)}>Auth &#x2193;</span>
                </>:<>
                    <span onClick={() => setShowAuthToken(true)}>Auth &#x2191;</span>
                </>}
            </div>
            <div className="boxstyle check-warn" style={{marginTop:"15pt",marginLeft:"90pt",marginRight:"90pt",padding:"10pt",color:"darkred"}}>
                Not logged in.
                Click <u style={{cursor:"pointer"}} onClick={() => login()}><b>here</b></u> to <span style={{cursor:"pointer"}} onClick={() => login()}><b>login</b></span>.
                {(header?.app?.credentials?.aws_account_number) && <>
                    <br /> <small>AWS Account: {header?.app?.credentials?.aws_account_number}</small>
                </>}
            </div>
            { showingAuthToken && <>
                { Cookie.HasAuthToken() &&
                    <div className="boxstyle check-warn" style={{marginLeft:"90pt",marginRight:"90pt",color:"darkred",fontSize:"small"}}>
                        <span onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer",color:"darkred"}}><b>AuthToken</b> from Cookie</span>
                        <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkred",fontWeight:"bold",marginTop:"6pt"}}>
                            <span style={{fontSize:"0",opacity:"0"}} id={"authtoken"}>{Json.Str(header?.auth)}</span>
                            <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken")} style={{float:"right",height:"20px",cursor:"copy"}} />
                            {Yaml.Format(Cookie.AuthToken())}
                        </pre>
                        <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkred",fontWeight:"bold",marginTop:"-3pt",whiteSpace:"break-spaces"}}>
                            <span style={{fontSize:"0",opacity:"0"}} id={"authtoken-raw"}>{Cookie.AuthTokenRaw()}</span>
                            <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken-raw")} style={{float:"right",height:"20px",cursor:"copy"}} />
                            {Cookie.AuthTokenRaw()}
                        </pre>
                    </div>
                }
                <div className="boxstyle check-warn" style={{marginLeft:"90pt",marginRight:"90pt",color:"darkred",fontSize:"small"}}>
                    <span onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer",color:"darkred"}}><b>Auth</b> from API</span>
                    <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkred",fontWeight:"bold",marginTop:"6pt"}}>
                        <span style={{fontSize:"0",opacity:"0"}} id={"authtoken"}>{Json.Str(header?.auth)}</span>
                        <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken")} style={{float:"right",height:"20px",cursor:"copy"}} />
                        {Yaml.Format(header?.auth)}
                    </pre>
                </div>
            </>}
        </div>
        <br /><br /><br />
        <div>
            <div id="login_auth_container" style={{verticalAlign:"top",align:"top",backgroundColor:"#143c53", height: "fit-content", borderRadius: "8px", borderStyle: "solid", borderWidth: "1px", display: "none", width:"fit-content", padding:"0px", margin: "auto"}}></div>
                <center id="login_auth_cancel" style={{display:"none",marginTop:"10px"}}>
                    <NavLink to={Client.Path("/info")} style={{fontSize:"small",cursor:"pointer",color:"blue"}}>Cancel</NavLink>
                </center>
            { showAuthBoxAtOutset && (setTimeout(() => { if (showAuthBoxAtOutset && !showingAuthBox) { showAuthBox(); }}, 10), "") }
        </div>
        </React.Fragment>)}
    </>
};

export default LoginPage;
