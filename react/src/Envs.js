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

    const boxClass = !info.env_unknown && URL.Env() != "" ? "boxstyle info" : "boxstyle check-warn";
    const boxTextColor = !info.env_unknown && URL.Env() != "" ? "darkblue" : "#6F4E37";

    // This page is unprotected.

    if (info.error) return <>Cannot load Foursight</>;
    if (info.loading) return <>Loading ...</>;
    return <div>
            { !IsLoggedIn() ? (
                <div className="container">
                    <b>&nbsp;Note</b>
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:"#6F4E37"}}>
                        <b>Not Logged In</b> <br />
                        <small>
                            Click <Link to={URL.Url("/login", true, info)} style={{cursor:"pointer",color:"#6F4E37"}}><b>here</b></Link> to go to the <Link to={URL.Url("/login", true, info)} style={{cursor:"pointer",color:"#6F4E37"}}><b>login</b></Link> page.
                        </small>
                        </div>
                </div>
            ):(<span/>)}
            <div className="container">
                <b>&nbsp;Environment</b>
                { (info.env_unknown || URL.Env() == "") ? (<React.Fragment>
                <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    { !URL.Env() ? (<span>
                        No environment specified in URL!
                    </span>):(<span>
                        Unknown environment: <b style={{color:"darkred"}}>{info?.app?.env}</b>
                    </span>)}
                </div>
                </React.Fragment>):(<React.Fragment>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    Current environment: <b style={{color:boxTextColor}}>{info?.app?.env}</b>
                </div>
                </React.Fragment>)}
            </div>
            <div className="container">
                <b>&nbsp;Available Environments</b>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                        {info?.envs?.unique_annotated.map((env) =>
                            <span key={env.full}>&#x2192;&nbsp;&nbsp;
                                <a href={URL.Url("/home", env.full)}><b style={{color:boxTextColor}}>{env.full}</b></a>
                                    <br />
                                    <span>&nbsp;&nbsp;&nbsp;&nbsp;</span> Full Name: {env.full} <br />
                                    <span>&nbsp;&nbsp;&nbsp;&nbsp;</span> Short Name: {env.short} <br />
                                    <span>&nbsp;&nbsp;&nbsp;&nbsp;</span> GAC Name: {env.gac_name} <br />
                                { isDefaultEnv(env, info) ? (<span>
                                    &nbsp;&nbsp;&#x272e;
                                </span>):(<span>
                                </span>)}
                            </span>
                        )}
                </div>
            </div>

    </div>
};

export default Envs;
