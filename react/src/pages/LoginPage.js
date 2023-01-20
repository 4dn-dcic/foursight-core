import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useHeader from '../hooks/Header';
import Auth0Lock from 'auth0-lock';
import Auth from '../utils/Auth';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import { FetchErrorBox } from '../Components';
import Cookie from '../utils/Cookie';
import Env from '../utils/Env';
import Image from '../utils/Image';
import Json from '../utils/Json';
import LiveTime from '../LiveTime';
import { LoggedInUser, Link } from '../Components';
import { LoginCognitoBox } from './LoginCognitoBox';
import Logout from '../utils/Logout';
import Server from '../utils/Server';
import Tooltip from '../components/Tooltip';
import Yaml from '../utils/Yaml';
import Page from '../Page';
import useFetch from '../hooks/Fetch';

const LoginPage = (props) => {

    const header = useHeader();
    const [ showingAuthBox, setShowingAuthBox ] = useState(false);
    const [ showingAuthToken, setShowAuthToken ] = useState(false);
    const [ args ] = useSearchParams();
    const showAuthBoxAtOutset = args.get("auth")?.length >= 0;
    const auth0Config = useFetch(Server.Url("/auth0_config", false));
    const [ showCognitoAuthBox, setShowCognitoAuthBox ] = useState(false);

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
        const payload = {
            container: "login_auth_container",
            auth: {
                redirectUrl: auth0Config?.data?.callback, // e.g. http://localhost:8000/callback?react
                responseType: "code",
                sso: auth0Config?.data?.sso,
                params: {
                    scope: auth0Config?.data?.scope,  // e.g. "openid email",
                    prompt: auth0Config?.data?.prompt // e.g. "select_account"
                }
            },
            socialButtonStyle: "big",
            languageDictionary: { title: "Foursight Login" },
            theme: {
                primaryColor: "blue",
                backgroundColor: "blue",
                logo: "",
            },
            allowedConnections: auth0Config?.data?.connections // e.g. [ "google-oauth2", "github" ]
        };
        return new Auth0Lock(auth0Config?.data?.client, auth0Config?.data?.domain, payload);
    }

    if ((header.loading || auth0Config.loading) && !header.error) return <>Loading ...</>
    if (header.error) return <FetchErrorBox error={header.error} message="Cannot load Foursight" />

    const InfoPanel = () => {
        return <>
            { Env.Current() && <>
                Current environment: <Link to="/env" env={Env.PreferredName(Env.Current(), header)}>{Env.PreferredName(Env.Current(), header)}</Link> <br />
            </>}
            { header?.auth?.initial_env && <>
                Initial environment: <Link to="/env" env={Env.PreferredName(header.auth.initial_env, header)} bold={false}>{Env.PreferredName(header.auth.initial_env, header)}</Link> <br />
            </>}
            { Env.KnownEnvs(header) && <>
                Available environments:
                {Env.KnownEnvs(header).map((env, index) => {
                    return <span key={index}>
                        {index > 0 && <>,</>}
                        &nbsp;{Env.PreferredName(env, header)}
                    </span>
                })} <br />
            </>}
            { header?.auth?.domain && <>
                Domain: {header.auth.domain} <br />
            </>}
            {(header?.app?.credentials?.aws_account_number) && <>
                AWS Account Number: <b>{header?.app?.credentials?.aws_account_number}</b>
                {(header?.app?.credentials?.aws_account_name) && <>
                    &nbsp;(<span id="tooltip-login-aws-alias">{header?.app?.credentials?.aws_account_name}</span>)
                    <Tooltip id="tooltip-login-aws-alias" position="bottom" text={`AWS Account Alias: ${header?.app?.credentials?.aws_account_name}`} />
                </>}
                <br />
            </>}
        </>
    }

    if (showCognitoAuthBox) return <LoginCognitoBox hide={() => setShowCognitoAuthBox(false)} />
    return <>
        { Auth.IsLoggedIn(header) ? (<React.Fragment>
            <div className="container" style={{width:"800pt"}}>
                {Auth.LoggedInUserName(header) && <b>Hello, {Auth.LoggedInUserName(header)}</b>} ...
                <div style={{float:"right",marginRight:"8pt",fontSize:"small",cursor:"pointer"}}>
                    { (header.app?.accounts_file || header.app?.accounts_file_from_s3) && <>
                        <Link to="/accounts">Accounts</Link>&nbsp;|&nbsp;
                    </>}
                    <Link to="/env">Environments</Link>&nbsp;|&nbsp;
                    { showingAuthToken ? <>
                        <span onClick={() => setShowAuthToken(false)}><b>Auth</b> {Char.DownArrow}</span>
                    </>:<>
                        <span onClick={() => setShowAuthToken(true)}><b>Auth</b> {Char.UpArrow}</span>
                    </>}
                </div>
                <div className="box" style={{padding:"10pt"}}>
                    <table style={{color:"inherit"}}><tbody><tr>
                        <td align="top" style={{paddingRight:"14pt",verticalAlign:"top",whiteSpace:"nowrap",width:"40%"}}>
                            Logged in as:&nbsp;
                            <LoggedInUser link="user" />
                            <div style={{fontSize:"small",marginTop:"6pt",paddingTop:"5pt",borderTop:"1px solid"}}>
                                Session started: <LiveTime.FormatDuration start={Auth.Token().authenticated_at} verbose={true} fallback={"just now"} suffix={"ago"} tooltip={true} />&nbsp;
                                <br />
                                Session expires: <LiveTime.FormatDuration end={Auth.Token().authenticated_until} verbose={true} fallback={"now"} suffix={"from now"} tooltip={true} />&nbsp;
                                <br />
                                Click <span style={{textDecoration:"underline",fontWeight:"bold",cursor:"pointer"}}
                                    onClick={()=> Logout()}>here</span> to <span style={{cursor:"pointer"}} onClick={()=> Logout()}>logout</span>.
                            </div>
                        </td>
                        <td style={{paddingLeft:"12pt",borderLeft:"2px solid",width:"60%",textAlign:"top",verticalAlign:"top"}}><small style={{marginTop:"20pt"}}>
                            <InfoPanel />
                        </small></td>
                    </tr></tbody></table>
                </div>
                { !Env.IsAllowed(Env.Current(), header) && <>
                    <div className="box warning" style={{marginTop:"10pt",padding:"9pt",color:"darkred"}}>
                        Note that though you are logged in, you do not have permission to access the currently selected environment: <b style={{color:"red"}}>{Env.Current()}</b> <br />
                        <small>Click <Link to="/env"><u>here</u></Link> to go the the <Link to="/env">Environments Page</Link> to select another environment.</small>
                    </div>
                </>}
                { (Auth.LoggedInViaCognito()) && <>
                    <div className="box error thickborder" style={{marginTop:"6pt",padding:"6pt",color:"darkred",fontSize:"small"}}>
                        <img alt="cognito" src={Image.CognitoLogo()} style={{marginLeft:"2pt",marginRight:"8pt"}} height="22" />
                        <span style={{position:"relative",top:"1pt"}}>
                            Logged in via new AWS <b>Cognito</b> support.
                        </span>
                    </div>
                </> }
                { showingAuthToken && <>
                    <div className="box" style={{paddingLeft:"8pt",marginTop:"8pt",fontSize:"small"}}>
                        <span id="tooltip-login-cookie-size" onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer"}}><b>AuthToken</b> from Cookie</span>
                        <Tooltip id="tooltip-login-cookie-size" position="right" text={`Authentication cookie size: ${Cookie.AuthTokenRaw()?.length} bytes`} shape="squared" />
                        <pre className="box" style={{filter:"brightness(1.1)",background:"inherit",fontWeight:"bold",marginTop:"6pt"}}>
                            <span style={{fontSize:"0",opacity:"0"}} id={"authtoken"}>{Json.Str(Auth.Token())}</span>
                            <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken")} style={{float:"right",height:"20px",cursor:"copy"}} />
                            {Yaml.Format(Auth.Token())}
                        </pre>
                        <pre className="box" style={{filter:"brightness(1.1)",background:"inherit",fontWeight:"bold",marginTop:"-3pt",whiteSpace:"break-spaces"}}>
                            <span style={{fontSize:"0",opacity:"0"}} id={"auth"}>{Cookie.AuthTokenRaw()}</span>
                            <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("auth")} style={{float:"right",height:"20px",cursor:"copy"}} />
                            {Cookie.AuthTokenRaw()}
                        </pre>
                    </div>
                    { (Json.Str(Auth.Token()) !== Json.Str(header?.auth)) &&
                        <div className="box" style={{paddingLeft:"8pt",marginTop:"8pt",fontSize:"small"}}>
                            <span onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer"}}><b>Auth</b> from API</span>
                            <pre className="box" style={{filter:"brightness(1.1)",background:"inherit",fontWeight:"bold",marginTop:"6pt"}}>{Yaml.Format(header?.auth)}</pre>
                        </div>
                    }
                </>}
            </div>
        </React.Fragment>):(<React.Fragment>
        <div className="container" id="login_container">
            <div style={{float:"right",marginRight:"94pt",color:"darkred",fontSize:"small",cursor:"pointer"}}>
                { showingAuthToken ? <>
                    <span onClick={() => setShowAuthToken(false)}>Auth {Char.DownArrow}</span>
                </>:<>
                    <span onClick={() => setShowAuthToken(true)}>Auth {Char.UpArrow}</span>
                </>}
            </div>
            <div className="box warning" style={{marginTop:"15pt",marginLeft:"90pt",marginRight:"90pt",padding:"10pt",color:"darkred"}}>
                Not logged in.
                { Cookie.HasAuthToken() && Auth.SessionExpired() && <>
                    &nbsp;Login expired: <LiveTime.FormatDuration start={Auth.Token().authenticated_until} verbose={true} tooltip={true} /> ago.
                </>}
                <br />
                Click <u style={{cursor:"pointer"}} onClick={() => login()}><b>here</b></u> to <span style={{cursor:"pointer"}} onClick={() => login()}><b>login</b></span>.
                {(header?.app?.credentials?.aws_account_number) && <>
                    <br />
                    <small>
                        AWS Account Number: {header?.app?.credentials?.aws_account_number}
                        {(header?.app?.credentials?.aws_account_name) && <>
                            &nbsp;(<b id="tooltip-login-aws-alias-2">{header?.app?.credentials?.aws_account_name}</b>)
                            <Tooltip id="tooltip-login-aws-alias-2" position="bottom" text={`AWS Account alias: ${header?.app?.credentials?.aws_account_name}`} />
                        </>}
                    </small>
                </>}
            </div>
            <div className="box error thickborder" style={{marginTop:"8pt",marginLeft:"90pt",marginRight:"90pt",padding:"6pt",color:"darkred",fontSize:"small"}}>
                <img alt="cognito" src={Image.CognitoLogo()} style={{marginLeft:"2pt",marginRight:"8pt"}} height="22" />
                <span style={{position:"relative",top:"1pt"}}>
                    Click <b className="pointer" onClick={() => setShowCognitoAuthBox(true)}><u>here</u></b> to try the
                    new <b className="pointer" onClick={() => setShowCognitoAuthBox(true)}>login</b> via
                    AWS <b className="pointer" onClick={() => setShowCognitoAuthBox(true)}>Cognito</b> support.
                </span>
            </div>
            { showingAuthToken && <>
                { Cookie.HasAuthToken() &&
                    <div className="box warning" style={{marginLeft:"90pt",marginRight:"90pt",color:"darkred",fontSize:"small"}}>
                        <span onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer",color:"darkred"}}><b>AuthToken</b> from Cookie</span>
                        <pre className="box" style={{filter:"brightness(1.1)",background:"inherit",color:"darkred",fontWeight:"bold",marginTop:"6pt"}}>
                            <span style={{fontSize:"0",opacity:"0"}} id={"authtoken"}>{Json.Str(header?.auth)}</span>
                            <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken")} style={{float:"right",height:"20px",cursor:"copy"}} />
                            {Yaml.Format(Cookie.AuthToken())}
                        </pre>
                        <pre className="box" style={{filter:"brightness(1.1)",background:"inherit",color:"darkred",fontWeight:"bold",marginTop:"-3pt",whiteSpace:"break-spaces"}}>
                            <span style={{fontSize:"0",opacity:"0"}} id={"authtoken-raw"}>{Cookie.AuthTokenRaw()}</span>
                            <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken-raw")} style={{float:"right",height:"20px",cursor:"copy"}} />
                            {Cookie.AuthTokenRaw()}
                        </pre>
                    </div>
                }
                <div className="box warning" style={{marginLeft:"90pt",marginRight:"90pt",marginTop:"8pt",color:"darkred",fontSize:"small"}}>
                    <span onClick={() => setShowAuthToken(false)} style={{position:"relative",top:"4pt",left:"2pt",cursor:"pointer",color:"darkred"}}><b>Auth</b> from API</span>
                    <pre className="box" style={{filter:"brightness(1.1)",background:"inherit",color:"darkred",fontWeight:"bold",marginTop:"6pt"}}>
                        <span style={{fontSize:"0",opacity:"0"}} id={"authtoken"}>{Json.Str(header?.auth)}</span>
                        <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken")} style={{float:"right",height:"20px",cursor:"copy"}} />
                        {Yaml.Format(header?.auth)}
                    </pre>
                </div>
            </>}
        </div>
        { (auth0Config.loading) ? <>Loading Auth0 configuration ...</> : <>
            <br /><br /><br />
            <div>
                <div id="login_auth_container" style={{verticalAlign:"top",align:"top",backgroundColor:"#143c53", height: "fit-content", borderRadius: "8px", borderStyle: "solid", borderWidth: "1px", display: "none", width:"fit-content", padding:"0px", margin: "auto"}}></div>
                    <center id="login_auth_cancel" style={{display:"none",marginTop:"10px"}}>
                        <NavLink to={Client.Path("/info")} style={{fontSize:"small",cursor:"pointer",color:"blue"}}>Cancel</NavLink>
                    </center>
                { showAuthBoxAtOutset && (setTimeout(() => { if (showAuthBoxAtOutset && !showingAuthBox) { showAuthBox(); }}, 10), "") }
            </div>
        </>}
        </React.Fragment>)}
    </>
};

export default LoginPage;
