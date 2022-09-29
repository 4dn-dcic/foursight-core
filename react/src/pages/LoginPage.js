import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useContext, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Global from '../Global';
import Auth0Lock from 'auth0-lock';
import Auth from '../utils/Auth';
import Client from '../utils/Client';
import Context from '../utils/Context';
import Cookie from '../utils/Cookie';
import LiveTime from '../LiveTime';
import ENV from '../utils/ENV';
import LOGOUT from '../utils/LOGOUT';
import TIME from '../utils/TIME';
import YAML from '../utils/YAML';
import Page from '../Page';

const LoginPage = (props) => {

    const [ header ] = useContext(Global);
    const [ showingAuthBox, setShowingAuthBox ] = useState(false);
    let [ showingAuthToken, setShowAuthToken ] = useState(false);
    let [ showingAuthEnvs, setShowAuthEnvs ] = useState(false);
    const [args] = useSearchParams();
    const showAuthBoxAtOutset = args.get("auth")?.length >= 0;
        console.log('renderrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr' + TIME.FormatDateTime(new Date()));

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
        const loginCallback = Context.Authentication.CallbackUrl();
        const loginClientId = Context.Authentication.CallbackId(header);
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
            <div className="container">
                {Auth.LoggedInUserName(header) && <b style={{marginLeft:"4pt",color:"darkblue"}}>Hello, {Auth.LoggedInUserName(header)} ...</b>}
                <div style={{float:"right",marginRight:"8pt",color:"darkblue",fontSize:"small",cursor:"pointer"}}>
                    { showingAuthToken ? <>
                        <span onClick={() => setShowAuthToken(false)}><b>AuthToken</b> &#x2193;</span>
                    </>:<>
                        <span onClick={() => setShowAuthToken(true)}><b>AuthToken</b> &#x2191;</span>
                    </>}
                    &nbsp;|&nbsp;
                    { showingAuthEnvs ? <>
                        <span onClick={() => setShowAuthEnvs(false)}><b>AuthEnvs</b> &#x2193;</span>
                    </>:<>
                        <span onClick={() => setShowAuthEnvs(true)}><b>AuthEnvs</b> &#x2191;</span>
                    </>}
                </div>
                <div className="boxstyle info" style={{marginLeft:"0pt",padding:"10pt",color:"darkblue"}}>
                    { Auth.IsFauxLoggedIn() ? (<span>
                        Logged in as:&nbsp;<b>faux-login</b>
                        <br />
                        <small>
                            Click <span style={{color:"darkblue",textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}} onClick={()=> LOGOUT()}>here</span> to <span style={{cursor:"pointer",color:"darkblue"}} onClick={()=> LOGOUT()}>logout</span>.
                        </small>
                    </span>):(<span>
                        <table style={{color:"inherit"}}><tbody><tr>
                            <td align="top" style={{whiteSpace:"nowrap"}}>
                                Logged in as:&nbsp;
                                <Link to={Client.Path("/users/" + Auth.LoggedInUser(header))}><b style={{color:"darkblue"}}>{Auth.LoggedInUser(header)}</b></Link> <br />
                                <div style={{fontSize:"small",marginTop:"3pt"}}>
                                    Click <span style={{color:"darkblue",textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}}
                                            onClick={()=> LOGOUT()}>here</span> to <span style={{cursor:"pointer",color:"darkblue"}} onClick={()=> LOGOUT()}>logout</span>.
                                </div>
                            </td>
                            <td style={{width:"8pt"}}></td>
                            <td style={{background:"darkblue",width:"2px"}}></td>
                            <td style={{width:"8pt"}}></td>
                            <td style={{textAlign:"top"}}><small style={{marginTop:"20pt"}}>
                                Logged in: <LiveTime.FormatDuration start={Auth.Token().authorized_at} verbose={true} fallback={"just now"} suffix={"ago"} tooltip={true} />&nbsp;
                                <br />
                                Session expires: <LiveTime.FormatDuration end={Auth.Token().authorized_until} verbose={true} fallback={"now"} suffix={"from now"} tooltip={true} />&nbsp;
                            </small></td>
                        </tr></tbody></table>
                    </span>)}
                </div>
                { showingAuthToken &&
                    <div className="boxstyle info" style={{paddingLeft:"8pt",color:"darkblue",fontSize:"small"}}>
                        <span onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer",color:"darkblue"}}><b>AuthToken</b> (server-side encrypted cookie)</span>
                        <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkblue",fontWeight:"bold",marginTop:"6pt"}}>{YAML.Format(Auth.LoggedInUserAuthToken(header))}</pre>
                    </div>
                }
                { showingAuthEnvs &&
                    <div className="boxstyle info" style={{paddingLeft:"8pt",color:"darkblue",fontSize:"small"}}>
                        <span onClick={() => setShowAuthEnvs(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer",color:"darkblue"}}><b>AuthEnvs</b> (base-64 encoded cookie)</span>
                        <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkblue",fontWeight:"bold",marginTop:"6pt"}}>{YAML.Format(Auth.LoggedInUserAuthEnvs(header))}</pre>
                    </div>
                }
            </div>
        </React.Fragment>):(<React.Fragment>
        <div className="container" id="login_container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt"}}>
                Not logged in.
                Click <u style={{cursor:"pointer"}} onClick={() => login()}><b>here</b></u> to <span style={{cursor:"pointer"}} onClick={() => login()}>login</span>.
                {(header?.app?.credentials?.aws_account_number) ? (<React.Fragment>
                    <br /> <small> AWS Account: {header?.app?.credentials?.aws_account_number} </small>
                    <br/>
                </React.Fragment>):(<React.Fragment>
                </React.Fragment>)}
            </div>
        </div>
        <br /><br /><br />
        <div>
            <div id="login_auth_container" style={{verticalAlign:"top",align:"top",backgroundColor:"#143c53", height: "fit-content", borderRadius: "8px", borderStyle: "solid", borderWidth: "1px", display: "none", width:"fit-content", padding:"0px", margin: "auto"}}></div>
                <center id="login_auth_cancel" style={{display:"none",marginTop:"10px"}}>
                    <NavLink to={Client.Path("/info")} style={{fontSize:"small",cursor:"pointer",color:"blue"}}>Cancel</NavLink>
                </center>
            { (Client.IsLocal() && showingAuthBox) && (
                <div className="container" style={{maxWidth:"290pt",marginTop:"-20pt"}}>
                    <div className="boxstyle check-fail" style={{margin:"20pt",padding:"10pt",borderWidth:"2",borderColor:"red"}}>
                        <img src={"https://i.stack.imgur.com/DPBue.png"} style={{height:"35",verticalAlign:"bottom"}} /> <b style={{fontSize:"x-large"}}>&nbsp;Attention ...</b> <br />
                        <hr style={{borderTop: "2px solid red",marginTop:"8px",marginBottom:"8px"}}/>
                        As you appear to be <b>running</b> Foursight <b>locally</b> {Context.IsLocalCrossOrigin() && <span>(cross-origin)</span>}, the above <a href="https://auth0.com/" style={{color:"red"}} target="_blank">Auth0</a> login <u><b>may not work</b></u>. <br />
                        <hr style={{borderTop: "1px solid red",marginTop:"8px",marginBottom:"8px"}}/>
                        It <u><b>should work</b></u> but just in case you can bypass this and <b>faux</b> login below. 
                        <hr style={{borderTop: "1px solid red",marginTop:"8px",marginBottom:"8px"}}/>
                        Click <Link to={{pathname: "/redirect"}} state={{url: Page.LastPath()}} onClick={() => Cookie.SetFauxLogin()} style={{textDecoration:"underline",fontWeight:"bold",cursor:"pointer",color:"darkred"}}>here</Link> to faux <Link to={{pathname: "/redirect"}} state={{url: Page.LastPath()}} onClick={() => Cookie.SetFauxLogin()} style={{cursor:"pointer",color:"darkred"}}><b>login</b></Link> locally.
                    </div>
                </div>
            )}
            { showAuthBoxAtOutset && (setTimeout(() => { if (showAuthBoxAtOutset && !showingAuthBox) { showAuthBox(); }}, 10), "") }
        </div>
        </React.Fragment>)}
    </>
};

export default LoginPage;
