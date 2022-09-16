import '../css/App.css';
import React from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useContext, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import GlobalContext from '../GlobalContext';
import Auth0Lock from 'auth0-lock';
import * as URL from '../utils/URL';
import { Auth0CallbackUrl, IsLoggedIn, Logout, ValidEnvRequired } from '../utils/LoginUtils';
import CLIENT from '../utils/CLIENT';
import COOKIE from '../utils/COOKIE';
import AUTH from '../utils/AUTH';

const LoginPage = (props) => {

    let navigate = useNavigate();
    const [ info ] = useContext(GlobalContext);
    const [ showingAuthBox, setShowingAuthBox ] = useState(false);
    const [args] = useSearchParams();
    const showAuthBoxAtOutset = args.get("auth")?.length >= 0;

    function login() {
        showAuthBox();
    }

    function showAuthBox() {
        document.getElementById("login_container").style.display = "none";
        document.getElementById("login_auth_container").style.display = "block";
        document.getElementById("login_auth_cancel").style.display = "block";
        COOKIE.SetRedirect(CLIENT.LastUrl());
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

    function hideAuthBox() {
        document.getElementById("login_auth_container").style.display = "none";
        document.getElementById("login_auth_cancel").style.display = "none";
        setShowingAuthBox(false);
    }

    function createAuth0Lock() {
        const loginCallback = Auth0CallbackUrl();
        const loginClientId = info?.app?.credentials?.auth0_client_id;
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

    if (info.loading && !info.error) return <>Loading ...</>
    if (info.error) return <>Cannot load Foursight.</>
    const loginInfo = IsLoggedIn() ? AUTH.LoggedInUserJwt(info) : undefined;;
    return <ValidEnvRequired>
        { IsLoggedIn() ? (<React.Fragment>
            <div className="container">
                <div className="boxstyle info" style={{margin:"20pt",padding:"10pt",color:"darkblue"}}>
                    Logged in as:&nbsp;
                    { false && CLIENT.IsLocal() ? (<span>
                        &nbsp;<b>localhost</b>
                    </span>):(<span>
                        <Link to={CLIENT.Path("/users/" + loginInfo?.email)}><b style={{color:"darkblue"}}>{loginInfo?.email}</b></Link>
                            {/* <br /> <small>Click <u style={{fontWeight:"bold",cursor:"pointer"}} onClick={()=> Logout(navigate)}>here</u> to <span onClick={()=>{Logout(navigate);}}>logout</span>.</small> */}
                        <br />
                        <small>
                            {/* Click <NavLink to={URL.Url("/logindone", true)} style={{color:"darkblue",textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}} onClick={()=> Logout()}>here</NavLink> to <NavLink to={URL.Url("/logindone", true)} style={{cursor:"pointer",color:"darkblue"}} onClick={()=> Logout()}>logout</NavLink>. */}
                            {/* Click <Link to={{pathname: "/redirect"}} state={{url: URL.Url("/login", true)}} style={{color:"darkblue",textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}} onClick={()=> Logout()}>here</Link> to <Link to={{pathname: "/redirect"}} state={{url: URL.Url("/login", true)}} style={{cursor:"pointer",color:"darkblue"}} onClick={()=> Logout()}>logout</Link>. */}

                            {/* Click <a href={API.Url("/logout", true)} style={{color:"darkblue",textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}} onClick={()=> Logout()}>here</a> to <Link to={{pathname: "/redirect"}} state={{url: CLIENT.Path("/login")}} style={{cursor:"pointer",color:"darkblue"}} onClick={()=> Logout()}>logout</Link>. */}
                            Click <span style={{color:"darkblue",textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}} onClick={()=> AUTH.Logout()}>here</span> to <span style={{cursor:"pointer",color:"darkblue"}} onClick={()=> AUTH.Logout()}>logout</span>.
                        </small>
                    </span>)}
                </div>
            </div>
        </React.Fragment>):(<React.Fragment>
        <div className="container" id="login_container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt"}}>
                Not logged in.
                Click <u style={{cursor:"pointer"}} onClick={() => login()}><b>here</b></u> to <span style={{cursor:"pointer"}} onClick={() => login()}>login</span>.
                {(info?.app?.credentials?.aws_account_number) ? (<React.Fragment>
                    <br /> <small> AWS Account: {info?.app?.credentials?.aws_account_number} </small>
                    <br/>
                </React.Fragment>):(<React.Fragment>
                </React.Fragment>)}
            </div>
        </div>
        <br /><br /><br />
        <div>
            <div id="login_auth_container" style={{verticalAlign:"top",align:"top",backgroundColor:"#143c53", height: "fit-content", borderRadius: "8px", borderStyle: "solid", borderWidth: "1px", display: "none", width:"fit-content", padding:"0px", margin: "auto"}}></div>
                <center id="login_auth_cancel" style={{display:"none",marginTop:"10px"}}>
                    <NavLink to={CLIENT.Path("/info")} style={{fontSize:"small",cursor:"pointer",color:"blue"}}>Cancel</NavLink>
                </center>
            { (CLIENT.IsLocal() && showingAuthBox) && (
                <div className="container" style={{maxWidth:"290pt",marginTop:"-20pt"}}>
                    <div className="boxstyle check-fail" style={{margin:"20pt",padding:"10pt",borderWidth:"2",borderColor:"red"}}>
                        <img src={"https://i.stack.imgur.com/DPBue.png"} style={{height:"35",verticalAlign:"bottom"}} /> <b style={{fontSize:"x-large"}}>&nbsp;Attention ...</b> <br />
                        <hr style={{borderTop: "2px solid red",marginTop:"8px",marginBottom:"8px"}}/>
                        As you appear to be <b>running</b> Foursight <b>locally</b>, the above <a href="https://auth0.com/" target="_blank">Auth0</a> login <u><b>may not work</b></u> properly. <br />
                        <hr style={{borderTop: "1px solid red",marginTop:"8px",marginBottom:"8px"}}/>
                        It <i>should</i> but just in case you can also bypass this and faux login below. 
                        <hr style={{borderTop: "1px solid red",marginTop:"8px",marginBottom:"8px"}}/>
                    {/* Click <NavLink onClick={() => SetFauxLoginCookie()} to={URL.Url("/logindone", true)} style={{textDecoration:"underline",fontWeight:"bold",cursor:"pointer",color:"darkred"}}>here</NavLink> to faux <NavLink onClick={() => SetFauxLoginCookie()} to={URL.Url("/logindone", true)} style={{cursor:"pointer",color:"darkred"}}><b>login</b></NavLink> locally. */}
                        Click <Link to={{pathname: "/redirect"}} state={{url: CLIENT.LastUrl()}} onClick={() => COOKIE.SetFauxLoginCookie()} style={{textDecoration:"underline",fontWeight:"bold",cursor:"pointer",color:"darkred"}}>here</Link> to faux <Link to={{pathname: "/redirect"}} state={{url: CLIENT.LastUrl()}} onClick={() => COOKIE.SetFauxLoginCookie()} style={{cursor:"pointer",color:"darkred"}}><b>login</b></Link> locally.
                    </div>
                </div>
            )}
            { showAuthBoxAtOutset && (setTimeout(() => { if (showAuthBoxAtOutset && !showingAuthBox) { showAuthBox(); }}, 10), "") }
        </div>
        </React.Fragment>)}
    </ValidEnvRequired>
};

export default LoginPage;
