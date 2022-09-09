import './App.css';
import React from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useContext, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import GlobalContext from './GlobalContext.js';
import Auth0Lock from 'auth0-lock';
import * as URL from './URL';
import { DeleteCookie, GetCookie, SetCookie } from './CookieUtils';
import { Auth0CallbackUrl, GetLoginInfo, IsLoggedIn, IsRunningLocally, Logout, ValidEnvRequired } from './LoginUtils.js';

const Login = (props) => {

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
        createRedirectCookie();
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
        const loginCallback = Auth0CallbackUrl("/api/callback/");
        const loginClientId = info?.app?.credentials?.auth0_client_id;
        const loginPayload = {
            container: "login_auth_container",
            auth: {
                redirectUrl: loginCallback,
                responseType: "code",
                sso: false,
                params: { scope: "openid email", prompt: "select_account" }
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

    function createRedirectCookie() {
        let expires = new Date();
        expires.setFullYear(expires.getFullYear() + 1);
        expires = expires.toUTCString();
        const redirectUrl = window.location.origin + URL.Url("/home", true);
        SetCookie("redir_react", redirectUrl, expires);
    }

    if (info.loading && !info.error) return <>Loading ...</>
    if (info.error) return <>Cannot load Foursight.</>
    const loginInfo = IsLoggedIn() ? GetLoginInfo() : undefined;;
    return <ValidEnvRequired>
        { IsLoggedIn() ? (<React.Fragment>
            <div className="container">
                <div className="boxstyle info" style={{margin:"20pt",padding:"10pt",color:"darkblue"}}>
                    Logged in as:&nbsp;
                    { false && IsRunningLocally() ? (<span>
                        &nbsp;<b>localhost</b>
                    </span>):(<span>
                        <Link to={URL.Url("/users/" + loginInfo?.email, true)}><b style={{color:"darkblue"}}>{loginInfo?.email}</b></Link>
                            {/* <br /> <small>Click <u style={{fontWeight:"bold",cursor:"pointer"}} onClick={()=> Logout(navigate)}>here</u> to <span onClick={()=>{Logout(navigate);}}>logout</span>.</small> */}
                        <br />
                        <small>
                            Click <NavLink to={URL.Url("/logindone", true)} style={{color:"darkblue",textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}} onClick={()=> Logout()}>here</NavLink> to <NavLink to={URL.Url("/logindone", true)} style={{cursor:"pointer",color:"darkblue"}} onClick={()=> Logout()}>logout</NavLink>.
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
                    <NavLink to={URL.Url("/info", true)} style={{fontSize:"small",cursor:"pointer",color:"blue"}}>Cancel</NavLink>
                </center>
            { (IsRunningLocally() && showingAuthBox) && (
                <div className="container" style={{maxWidth:"290pt",marginTop:"-20pt"}}>
                    <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt"}}>
                        <small>
                        As you appear to be <b>running</b> Foursight <b>locally</b>, the above Auth0 will not work. <br />
                    {/* Click <b style={{cursor:"pointer"}} onClick={(x) => { hideAuthBox(); SetCookie("test_mode_login_localhost", "1"); window.location.reload(); }}><u>here</u></b> for faux local login. */}
                        Click <NavLink onClick={() => SetCookie("test_mode_login_localhost", "1")} to={URL.Url("/logindone", true)} style={{textDecoration:"underline",fontWeight:"bold",cursor:"pointer",color:"darkred"}}>here</NavLink> to faux <NavLink onClick={() => SetCookie("test_mode_login_localhost", "1")} to={URL.Url("/logindone", true)} style={{fontSize:"small",cursor:"pointer",color:"darkred"}}>login</NavLink> locally.
                        </small>
                    </div>
                </div>
            )}
            { showAuthBoxAtOutset && setTimeout(() => { if (showAuthBoxAtOutset && !showingAuthBox) { showAuthBox(); }}, 1) }
        </div>
        </React.Fragment>)}
    </ValidEnvRequired>
};

export const LoginAuth = () => {
    console.log("LOGIN-AUTH");
}

export default Login;
