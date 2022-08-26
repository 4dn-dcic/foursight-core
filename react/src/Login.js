import './App.css';
import React from 'react';
import { Component, useContext, useEffect} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { BASE_URL_PATH, URL, URLE, getEnvFromUrlPath } from "./Utils.js";
import { RingSpinner, BarSpinner } from "./Spinners.js";
import Auth0Lock from 'auth0-lock';
import { GetCookie, SetCookie, DeleteCookie, GetJwtTokenCookie, GetDecodedJwtTokenCookie } from './CookieUtils.js';
import { IsLoggedIn } from './LoginUtils.js';

const Login = (props) => {

    let navigate = useNavigate();
    const [ info, setInfo ] = useContext(GlobalContext);
    const path = window.location.pathname;

    console.log("LOGGED IN");
    console.log(IsLoggedIn());

    if (!info.loading) {
    }

    function isLoggedIn() {
    }

    function createRedirectCookie() {
        var expr = new Date();
        expr.setFullYear(expr.getFullYear() + 1);
        document.cookie = "redir=" + window.location.href + "; path=/; expires=" + expr.toUTCString();
    }

    function login() {
        if (info.loading) return
        //const callback = "https://" + info.page.domain + info.page.context + "callback/";
        const loginCallback = "https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/callback/";
        const loginClientId = info.app.credentials.auth0_client_id;
        const loginPayload = {
            container: 'login-auth-container',
            auth: {
                redirectUrl: loginCallback,
                responseType: 'code',
                sso: false,
                params: {scope: 'openid email', prompt: 'select_account'}
            },
            socialButtonStyle: 'big',
            languageDictionary: { title: "Foursight Login" },
            theme: {
                primaryColor: "blue",
                backgroundColor: "blue",
                logo: "",
            },
            allowedConnections: ['github', 'google-oauth2']
        };
        document.getElementById("login-container").style.display = "none";
        document.getElementById("login-auth-container").style.display = "block";
        let authLock = new Auth0Lock(loginClientId, 'hms-dbmi.auth0.com', loginPayload);
        authLock.show()
        //
        // Hacking styles for (now) embeded (rather than popup) Auth0 login box.
        //
        const isFirefoxBrowser = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        if (isFirefoxBrowser) {
            // Firefox doesn't respect the fit-content on height so just disable the border entirely.
            document.getElementById("login-auth-container").style.height = "200";
            document.getElementById("login-auth-container").style.background = "white";
            document.getElementById("login-auth-container").style.borderStyle = "none";
        }
        document.getElementById("login-auth-container").firstChild.firstChild.style.paddingLeft = "1";
        document.getElementById("login-auth-container").firstChild.firstChild.style.paddingRight = "1";
        document.getElementById("login-auth-container").firstChild.firstChild.style.paddingTop = "1";
        document.getElementById("login-auth-container").firstChild.firstChild.style.paddingBottom = "1";
        document.getElementById("login-auth-container").firstChild.firstChild.style.fontWeight = "bold";
    }

    return (<>
        <div id="login-container">
            <span>Login <span onClick={()=>{login();}}>here</span> ...<br/></span>
            <span>JWT: [{GetJwtTokenCookie()}]<br/></span>
            <span>Decoded JWT: [{JSON.stringify(GetDecodedJwtTokenCookie())}]<br/></span>
            <span onClick={()=>{DeleteCookie("jwtToken");}}>Delete</span><br />
            <span onClick={()=>{SetCookie("jwtToken", "foobarxyzzy");}}>Create</span><br />
            <span onClick={()=>{window.alert(GetCookie("jwtToken"));}}>Show</span><br />
            <span onClick={()=>{window.alert(IsLoggedIn());}}>logged in</span><br />
        </div>
        <div id="login-auth-container" className="foo" style={{verticalAlign:"top",align:"top",backgroundColor:"#143c53", height: "fit-content", borderRadius: "8px", borderStyle: "solid", borderWidth: "1px", display: "none", width:"fit-content", padding:"0px", margin: "auto"}}></div>
    </>);
};

export default Login;
