import './App.css';
import React from 'react';
import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { BASE_URL_PATH, URL, URLE, getEnvFromUrlPath } from "./UrlUtils.js";
import { RingSpinner, BarSpinner } from "./Spinners.js";
import { IsLoggedIn } from "./LoginUtils.js";
import Auth0Lock from 'auth0-lock';

const Header = (props) => {

    let navigate = useNavigate();
    const [ info, setInfo ] = useContext(GlobalContext);
    const path = window.location.pathname;

    function createRedirectCookie() {
        var expr = new Date();
        expr.setFullYear(expr.getFullYear() + 1);
        document.cookie = "redir=" + window.location.href + "; path=/; expires=" + expr.toUTCString();
    }

    function deleteLoginCookies() {
        document.cookie = "jwtToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname + ";";
    }

        console.log('a')
    function login() {
        console.log('e')
        if (info.loading) return
        //const callback = "https://" + info.page?.domain + info.page?.context + "callback/";
        const loginCallback = "https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/callback/";
        console.log('asdfadf')
        console.log(info.app?.credentials);
        const loginClientId = info.app?.credentials.auth0_client_id;
        const loginPayload = {
            container: 'login-container',
            auth: {
                redirectUrl: loginCallback,
                responseType: 'code',
                sso: false,
                params: {scope: 'openid email', prompt: 'select_account'}
            },
            languageDictionary: { title: "Foursight Login" },
            socialButtonStyle: 'big',
            theme: {
                primaryColor: "blue",
                logo: info.page?.favicon,
            },
            allowedConnections: ['github', 'google-oauth2']
        };
        document.getElementById("login-container").style.display = "block";
        let auth0Lock = new Auth0Lock(loginClientId, 'hms-dbmi.auth0.com', loginPayload);
        auth0Lock.show()
    }
        console.log('b')

    function renderNavigationLinks(info) {
        console.log('d')
        function weight(page) {
            return path.startsWith(BASE_URL_PATH + getEnvFromUrlPath() + page) ? "bold" : "normal";
        }
        function color(page) {
            return path.startsWith(BASE_URL_PATH + getEnvFromUrlPath() + page) ? "black" : "blue";
        }
        return <span>
            <Link to={URL("/view")} style={{textDecoration:"none",color:color("/view"),fontWeight:weight("/view")}}>HOME</Link>&nbsp;|&nbsp;
            <Link to={URL("/users")} style={{textDecoration:"none",color:color("/users"),fontWeight:weight("/users")}}>USERS</Link>&nbsp;|&nbsp;
            <Link to={URL("/info")} style={{textDecoration:"none",color:color("/info"),fontWeight:weight("/info")}}>INFO</Link>&nbsp;|&nbsp;
            <a target="_blank" title="Open AWS Console for this account ({info.app?.credentials.aws_account_number}) in another tab."
                style={{textDecoration:"none"}}
                href={"https://" + info.app?.credentials.aws_account_number + ".signin.aws.amazon.com/console/"}>AWS <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px",fontSize:"14px"}}></span></a>
        </span>
    }
if (!info.loading) {
            console.log(info.envs?.unique_annotated)
            info.envs?.unique_annotated.map(env => console.log(env.name.toUpperCase()))
}

        console.log('c')
    return (<>
        <div style={{width:"100%",background:"#143c53"}}>{ info.loading ? (
            <table style={{width:"100%",height:"42px"}}><tbody>
            <tr>
                <td width="400" style={{height:"42px",paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href="">
                        <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                    </a>
                </td>
                <td width="400" style={{color:"white", nowrap:"1"}}>
                    <i style={{fontSize:"16pt",color:"yellow"}}>
                        Foursight Loading ...
                    </i>
                </td>
                <td width="10%" align="right">
                    <span style={{position:"relative",bottom:"5pt"}}>&nbsp;<BarSpinner loading={info.loading} color={'lightyellow'} size={150} /></span>
                </td>
            </tr>
            </tbody></table>
        ):(<React.Fragment>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
            <tr title={"App Deployed:" + info.app?.deployed + " | App Launched: " + info.app?.launched + " | Page Loaded: " + info.page?.loaded}>
                <td width="400" style={{paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href={info.page?.context + 'view/' + info.app?.env}>
                        <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                    </a>
                </td>
                <td align="center" style={{whiteSpace:"nowrap"}}>
                    <span style={{fontSize:"20pt",color:"white"}}>
                        <span style={{color:"default"}}>{info.page?.title}</span>&nbsp;
                        { info.app?.stage == 'dev' ? (<span>
                            &nbsp;<span title="Stage is DEV." style={{position:"relative",top:"1pt",color:"lightgreen",fontSize:"24pt"}}>&#x269B;</span>
                        </span>):(<span></span>)}
                        { info.app?.local ? (<span>
                            &nbsp;<span title="Running locally." style={{position:"relative",bottom:"1pt",color:"lightgreen",fontSize:"15pt"}}>&#8861;</span>
                        </span>):(<span></span>)}
                    </span>
                </td>
                <td width="400" style={{paddingRight:"10pt",whiteSpace:"nowrap",color:"#D6EAF8"}} align="right">
                    <small>{info.page?.loaded}</small>
                    &nbsp;<b>|</b>&nbsp;
                    <a style={{textDecoration:"none",color:"#D6EAF8"}} href="{info.page?.context + '__reload_lambda__/' + info.app?.env + '/current'}" title="Click to relaunch this app." onClick={() => { if (window.confirm('Do you want to relaunch this app?')){return true;}else{window.event.stopPropagation();window.event.preventDefault()}}}>&#x2318;</a>
                    { info.app?.local && info.login?.admin ? (<span>
                        &nbsp;<b>|</b>&nbsp; <span style={{cursor:"pointer",color:"#D6EAF8"}} onClick={() => {deleteLoginCookies();window.location.reload();}}>LOGOUT</span>
                    </span>):(<span></span>)}
                </td>
            </tr>
            </tbody></table>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
                <tr style={{background:"#AED6F1"}}>
                    <td width="400" style={{paddingLeft:"10pt",paddingTop:"3pt",paddingBottom:"3pt",whiteSpace:"nowrap"}}>
                        {renderNavigationLinks(info)}
                    </td>
                    <td align="center" style={{whiteSpace:"nowrap"}}>
                        <a target="_blank" href={"https://pypi.org/project/foursight-cgap/" + info.app?.version + "/"}><b title="Version of: foursight-cgap" style={{textDecoration:"none",color:"#263A48"}}>{info.app?.version}</b></a>
                    </td>
                    <td width="400" style={{paddingRight:"10pt",paddingTop:"2pt",paddingBottom:"1pt",whiteSpace:"nowrap"}} align="right" nowrap="1">
                        { (info.envs?.unique_annotated.length > 0) ? (
                        <span className="dropdown">
                            <b className="dropdown-button" style={{color:"#143c53"}} title="Environment: {getEnvFromUrlPath()}">{getEnvFromUrlPath().toUpperCase()}</b>
                            <div className="dropdown-content" id="dropdown-content-id">
                                { info.envs?.unique_annotated.map(env => 
                                    env.name.toUpperCase() == getEnvFromUrlPath().toUpperCase() || env.full.toUpperCase() == getEnvFromUrlPath().toUpperCase() || env.short.toUpperCase() == getEnvFromUrlPath().toUpperCase() || env.inferred.toUpperCase() == getEnvFromUrlPath().toUpperCase() ? (
                                        <span key={env.full}>{env.full}&nbsp;&nbsp;&#x2713;</span>
                                    ):(
                                        <a key={env.full} onClick={()=>{navigate(URLE(env.full))}}>{env.full}</a>
                                    )
                                )}
                                <div height="1" style={{marginTop:"2px",height:"1px",background:"darkblue"}}></div>
                                <a id="__envinfo__" onClick={()=>{navigate(URL("/info"));document.getElementById("__envinfo__").style.fontWeight="bold";}}>Environments Info</a>
                            </div>
                         </span>
                        ):(
                            <b style={{color:"#143c53"}} title="Environment: {getEnvFromUrlPath()}">asdfadfadf{getEnvFromUrlPath().toUpperCase()}</b>
                        )}
                        &nbsp;|&nbsp;
                        { (info.app?.stage == 'prod') ? (<span>
                            <b title="Deployment stage: PROD!" style={{color:"red"}}>PROD</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (info.app?.stage == 'dev') ? (<span>
                            <b title="Deployment stage: DEV" style={{color:"darkgreen"}}>DEV</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (info.app?.stage != 'prod' && info.app?.stage != 'dev') ? (<span>
                            <b title="Deployment stage: {info.app?.stage}">{info.app?.stage}}</b> &nbsp;|&nbsp;
                        </span>):(<span></span>)}
                        { (info.login?.admin) ? (<span>
                            { (info.login?.email_address) ? (<span>
                                <span style={{textDecoration:"none"}}><b title="" style={{color:"darkblue;"}} title="Logged in as.">{info.login?.email_address}</b></span>
                            </span>):(<span>
                                <b style={{color:"darkblue"}}>ADMIN</b>
                            </span>)}
                        </span>):(<span>
                            <Link to={URL("/login")} style={{cursor:"pointer",fontWeight:"bold",color:"darkred"}} title="Not logged in. Click to login.">LOGIN</Link>
                        </span>)}
                    </td>
                </tr>
                <tr>
                    <td style={{height:"1px",background:"darkblue"}}></td>
                </tr>
            </tbody></table>
        </React.Fragment>)}</div>
                    <div id="login-container" style={{display: "none", width: "320px", height:"fit-content", margin: "40px auto", padding: "10px", borderStyle: "dashed", borderWidth: "1px", boxSizing: "border-box"}}></div>
    </>);
};

export default Header;
