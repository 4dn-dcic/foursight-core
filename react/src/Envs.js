import React from 'react';
import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { IsLoggedIn } from "./LoginUtils.js";
import * as URL from './URL';
import { UUID } from './Utils';

const Envs = (props) => {

    let navigate = useNavigate();
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

    function onChange(arg, environ) {
        const environCompare = arg.target.value;
        navigate(URL.Url("/gac/" + environCompare, environ))
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
                    <table style={{color:"inherit"}}><thead></thead><tbody>
                        {info?.envs?.unique_annotated.map((env, envIndex) =>
                            <tr key={UUID()}>
                                <td style={{verticalAlign:"top"}}><span>&#x2192;&nbsp;&nbsp;</span></td>
                                <td>
                                    <a style={{color:URL.Env() == env.full ? "black" : "inherit"}} href={URL.Url("/envs", env.full)}><b>{env.full}</b></a>
                                        <br />
                                        Full Name: {env.full} <br />
                                        Short Name: {env.short} <br />
                                        GAC Name: {env.gac_name} <br />
                                        { !info.env_unknown ? (<React.Fragment>
                                            <select style={{border:"0",background:"transparent","-webkit-appearance":"none"}} onChange={(selected) => onChange(selected, env.full)}>
                                                <option>GAC Compare &#x2193;</option>
                                                { info.envs?.unique_annotated.map((env) =>
                                                    <option key={UUID()}>{env.full}</option>
                                                )}
                                            </select>
                                        </React.Fragment>):(<React.Fragment>
                                        </React.Fragment>)}
                                    { isDefaultEnv(env, info) ? (<span>
                                        &nbsp;&nbsp;&#x272e;
                                    </span>):(<span>
                                    </span>)}
                                    { (envIndex < info.envs.unique_annotated.length - 1) ? (<span>
                                        <br /><br />
                                    </span>):(<span/>)}
                                </td>
                            </tr>
                        )}
                    </tbody></table>
                </div>
            </div>
    </div>
};

export default Envs;
