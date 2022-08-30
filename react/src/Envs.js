import React from 'react';
import { useContext } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { IsLoggedIn } from "./LoginUtils.js";
import * as URL from './URL';

const Envs = (props) => {

    const [ info ] = useContext(GlobalContext);

    function getDefaultEnv(env, info) {
        return info?.env?.default?.toUpperCase();
    }

    function isDefaultEnv(env, info) {
        const defaultEnv = getDefaultEnv();
        if ((env?.full?.toUpperCase() == defaultEnv) ||
            (env?.short?.toUpperCase() == defaultEnv) ||
            (env?.public?.toUpperCase() == defaultEnv) ||
            (env?.foursight?.toUpperCase() == defaultEnv)) {
            return true;
        }
        else {
            return false;
        }
    }

    const boxClass = IsLoggedIn() && !info.env_unknown && URL.Env() != "" ? "info" : "check-warn";
    const boxTextColor = IsLoggedIn() && !info.env_unknown && URL.Env() != "" ? "darkblue" : "#6F4E37";

    // This page is unprotected.

    if (info.error) return <>Cannot load Foursight</>;
    if (info.loading) return <>Loading ...</>;
    return <div>
            <div className="container">
                <b>&nbsp;Environments</b>
                { (info.env_unknown || URL.Env() == "") ? (<React.Fragment>
                <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    { !URL.Env() ? (<span>
                        No environment specified in URL!
                    </span>):(<span>
                        Unknown environment: <b style={{color:"darkred"}}>{info?.app?.env}</b>
                    </span>)}
                    <br />
                    <small>
                        <div style={{height:"1px",marginTop:"10px",marginBottom:"10px",background:"#6F4E37"}}></div>
                        All known environments are listed below: <br />
                        {info?.envs?.unique_annotated.map((env) =>
                            <span key={env.full} >&#x2192;&nbsp;&nbsp;
                                <a href={URL.Url("/home", env.full)}> <b style={{color:boxTextColor}}>{env.full}</b></a>
                                { env.short != env.full ? (<span>
                                    &nbsp;({env.short})
                                </span>):(<span>
                                </span>)}
                                { isDefaultEnv(env, info) ? (<span>
                                    &nbsp;&nbsp;&#x272e;
                                </span>):(<span>
                                </span>)}
                            </span>
                        )}
                    </small>
                    { !IsLoggedIn() ? (<div>
                        <div style={{height:"1px",marginTop:"30px",marginBottom:"3px",background:boxTextColor}}></div>
                        <div style={{height:"1px",marginTop:"1px",marginBottom:"10px",background:boxTextColor}}></div>
                            {/* TODO: does not work - stays on same route or goes back or something - at least sometimes */}
                        Not logged in. Click <Link to={URL.Url("/login", false, info)} style={{cursor:"pointer",color:boxTextColor}}><b>here</b></Link> to go to the <Link to={URL.Url("/login", false, info)} style={{cursor:"pointer",color:boxTextColor}}><b>login</b></Link> page.
                    </div>):(<div/>)}
                </div>
                </React.Fragment>):(<React.Fragment>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    Current environment: <b style={{color:boxTextColor}}>{info?.app?.env}</b>
                    <br />
                    <small>
                        <div style={{height:"1px",marginTop:"10px",marginBottom:"10px",background:boxTextColor}}></div>
                        All known environments are listed below: <br />
                        {info?.envs?.unique_annotated.map((env) =>
                            <span key={env.full}>&#x2192;&nbsp;&nbsp;
                                <a href={URL.Url("/home", env.full)}><b style={{color:boxTextColor}}>{env.full}</b></a>
                                { env.short != env.full ? (<span>
                                    &nbsp;({env.short})
                                </span>):(<span>
                                </span>)}
                                { isDefaultEnv(env, info) ? (<span>
                                        &nbsp;&nbsp;&#x272e;
                                </span>):(<span>
                                </span>)}
                            </span>
                        )}
                    </small>
                    { !IsLoggedIn() ? (<div>
                        <div style={{height:"1px",marginTop:"30px",marginBottom:"3px",background:boxTextColor}}></div>
                        <div style={{height:"1px",marginTop:"1px",marginBottom:"10px",background:boxTextColor}}></div>
                        Not logged in. Click <Link to={URL.Url("/login", false, info)} style={{cursor:"pointer",color:boxTextColor}}><b>here</b></Link> to go to the <Link to={URL.Url("/login", false, info)} style={{cursor:"pointer",color:boxTextColor}}><b>login</b></Link> page.
                    </div>):(<div/>)}
                </div>
                </React.Fragment>)}
            </div>
        <hr />
    </div>
};

export default Envs;
