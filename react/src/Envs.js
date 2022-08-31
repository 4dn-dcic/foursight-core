import React from 'react';
import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { IsLoggedIn } from "./LoginUtils.js";
import * as URL from './URL';
import { UUID } from './Utils';

const Envs = (props) => {

    let navigate = useNavigate();
    // TODO: Change this name 'info' to 'header'!
    const [ info ] = useContext(GlobalContext);

    const currentEnv = URL.Env();

    function isKnownEnv(env = currentEnv, header = info) {
        if (!env) return false;
        env = env.toLowerCase();
        for (let i = 0 ; i < header.envs?.unique_annotated?.length ; i++) {
            const env_annotated = header.envs?.unique_annotated[i];
            if ((env_annotated.name.toLowerCase() == env) ||
                (env_annotated.full.toLowerCase() == env) ||
                (env_annotated.short.toLowerCase() == env) ||
                (env_annotated.public.toLowerCase() == env) ||
                (env_annotated.foursight.toLowerCase() == env)) {
                return true;
            }
        }
        return false;
    }

    function getDefaultEnv() {
        return info?.env?.default;
    }

    function isDefaultEnv(env, info) {
        const defaultEnv = getDefaultEnv().toLowerCase();
        if ((env?.full?.toLowerCase() == defaultEnv) ||
            (env?.short?.toLowerCase() == defaultEnv) ||
            (env?.public?.toLowerCase() == defaultEnv) ||
            (env?.foursight?.toLowerCase() == defaultEnv)) {
            return true;
        }
        else {
            return false;
        }
    }

    function isSameEnv(env, env_annotated) {
        env = env.toLowerCase()
        return (env_annotated.name.toLowerCase() == env) ||
               (env_annotated.full.toLowerCase() == env) ||
               (env_annotated.short.toLowerCase() == env) ||
               (env_annotated.public.toLowerCase() == env) ||
               (env_annotated.foursight.toLowerCase() == env);
    }

    function onChange(arg, environ) {
        const environCompare = arg.target.value;
        navigate(URL.Url("/gac/" + environCompare, environ))
    }

    const boxClass = isKnownEnv() ? "boxstyle info" : "boxstyle check-warn";
    const boxTextColor = isKnownEnv() ? "darkblue" : "#6F4E37";

    // This page is unprotected.

    if (info.error) return <>Cannot load Foursight</>;
    if (info.loading) return <>Loading ...</>;
    return <div>
            { !IsLoggedIn() ? (
                <div className="container">
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:"#6F4E37"}}>
                        <b>Not Logged In</b> <br />
                        <small>
                            Click <Link to={URL.Url("/login", !isKnownEnv() ? getDefaultEnv() : true, info)} style={{cursor:"pointer",color:"#6F4E37"}}><b>here</b></Link> to go to the <Link to={URL.Url("/login", !isKnownEnv() ? getDefaultEnv() : true, info)} style={{cursor:"pointer",color:"#6F4E37"}}><b>login</b></Link> page.
                        </small>
                        </div>
                </div>
            ):(<span/>)}
            <div className="container">
                <b>&nbsp;Environment</b>
                { !isKnownEnv() ? (<React.Fragment>
                <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    { !URL.Env() ? (<span>
                        No environment specified in URL!
                    </span>):(<span>
                        Unknown environment: <b style={{color:"darkred"}}>{currentEnv}</b>
                    </span>)}
                </div>
                </React.Fragment>):(<React.Fragment>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    Current environment: <b style={{color:boxTextColor}}>{URL.Env()}</b>
                </div>
                </React.Fragment>)}
            </div>
            <div className="container">
                <b>&nbsp;Available Environments</b>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    <table style={{color:"inherit"}}><thead></thead><tbody>
                        {info?.envs?.unique_annotated.map((env, envIndex) =>
                            <tr key={UUID()} title={isDefaultEnv(env, info) ? "This is the default environment" : ""}>
                                <td style={{verticalAlign:"top"}}><span>&#x2192;&nbsp;&nbsp;</span></td>
                                <td>
                                {/* TODO: make this a Link rather than an anchor - had some trouble previously */}
                                    <a  style={{color:isSameEnv(URL.Env(), env) ? "black" : "inherit"}} href={URL.Url("/envs", env.full)}><b>{env.full}</b></a>
                                    { isDefaultEnv(env, info) ? <b style={{color:!isKnownEnv() ? "darkred" : "darkblue"}}>&nbsp;&#x272e;</b> : <span/> }
                                        <br />
                                        Full Name: {env.full} <br />
                                        Short Name: {env.short} <br />
                                        Public Name: {env.public} <br />
                                        GAC Name: {env.gac_name} <br />
                                        { isKnownEnv() ? (<React.Fragment>
                                            <select style={{border:"0",background:"transparent","-webkit-appearance":"none"}} onChange={(selected) => onChange(selected, env.full)}>
                                                <option>GAC Compare &#x2193;</option>
                                                { info.envs?.unique_annotated.map((env) =>
                                                    <option key={UUID()}>{env.full}</option>
                                                )}
                                            </select>
                                        </React.Fragment>):(<React.Fragment>
                                        </React.Fragment>)}
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
