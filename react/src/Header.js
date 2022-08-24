import React from 'react';
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { URL } from "./Utils.js";

const Header = (props) => {

    const [ info, setInfo ] = useContext(GlobalContext);
    const path = window.location.pathname;

    function deleteLoginCookies() {
        document.cookie = "jwtToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=" + window.location.hostname + ";";
    }

    function renderNavigationLinks(info) {
        function weight(page) {
                console.log("WIGITH:");
                console.log(info.page.context + "react/" + info.app.env + page);
                console.log(path.startsWith(info.page.context + "react/" + info.app.env + page) ? "bold" : "normal");
            return path.startsWith(info.page.context + "react/" + info.app.env + page) ? "bold" : "normal";
        }
            console.log('renderheader');
        return <span>
            <Link to={URL("/view")} style={{textDecoration:"none",fontWeight:weight("/view")}}>HOME</Link> &nbsp;|&nbsp;
            <Link to={URL("/users")} style={{textDecoration:"none",fontWeight:weight("/users")}}>USERS</Link> &nbsp;|&nbsp;
            <Link to={URL("/info")} style={{textDecoration:"none",fontWeight:weight("/info")}}>INFO</Link>
        </span>
    }

    return (<>
        <div width="100%" height="70" style={{background:"#143c53"}}>{ info.loading ? (
            <table width="100%"><tbody>
            <tr>
                <td width="400" style={{paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href="">
                        <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                    </a>
                </td>
                <td width="400" style={{color:"white"}}>
                    Foursight Loading ...
                </td>
            </tr>
            </tbody></table>
        ):(<React.Fragment>
            <table width="100%" cellPadding="0" cellSpacing="0"><tbody>
            <tr>
                <td width="400" style={{paddingLeft:"2pt",whiteSpace:"nowrap"}}>
                    <a href={info.page.context + 'view/' + info.app.env} title={'abc' + info.env.name + 'def'}>
                        <img src="https://github.com/dbmi-bgm/cgap-pipeline/raw/master/docs/images/cgap_logo.png" width="130" />
                    </a>
                </td>
                <td align="center" style={{whiteSpace:"nowrap"}}>
                    <span style={{fontSize:"20pt",color:"white"}}>
                        <span style={{color:"default"}}>{info.page.title}</span>&nbsp;
                        { info.app.stage == 'dev' ? (<span>
                            &nbsp;<span title="Stage is DEV." style={{position:"relative",top:"1pt",color:"lightgreen",fontSize:"24pt"}}>&#x269B;</span>
                        </span>):(<span></span>)}
                        { info.app.local ? (<span>
                            &nbsp;<span title="Running locally." style={{position:"relative",bottom:"1pt",color:"lightgreen",fontSize:"15pt"}}>&#8861;</span>
                        </span>):(<span></span>)}
                    </span>
                </td>
                <td width="400" style={{paddingRight:"10pt",whiteSpace:"nowrap",color:"#D6EAF8"}} align="right">
                    <small>{info.page.loaded}</small>
                    &nbsp;<b>|</b>&nbsp;
                    <a style={{textDecoration:"none",color:"#D6EAF8"}} href="{info.page.context + 'reload_lambda/' + info.app.env + '/current'}" title="Click to relaunch this app." onClick={() => { if (window.confirm('Do you want to relaunch this app?')){return true;}else{window.event.stopPropagation();window.event.preventDefault()}}}>&#x2318;</a>
                    { info.app.local && info.login.admin ? (<span>
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
                </tr>
            </tbody></table>
        </React.Fragment>)}</div>
    </>);
};

export default Header;
