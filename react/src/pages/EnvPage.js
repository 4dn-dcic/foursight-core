import React from 'react';
import { useContext, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import GlobalContext from "../GlobalContext.js";
import { IsLoggedIn, NotePageLastVisited, IsAllowedEnv } from "../utils/LoginUtils";
import { fetchData } from '../utils/FetchUtils';
import * as API from "../utils/API";
import * as URL from '../utils/URL';
import { UUID } from '../utils/Utils';

const EnvPage = (props) => {

    NotePageLastVisited();

    // TODO: why not just get current env from useParams?
    // Relics of getting this kind of info from server.
    const { environ } = useParams() // TODO: use this
    let navigate = useNavigate();
    // TODO: Change this name 'info' to 'header'!
    const [ info, setInfo ] = useContext(GlobalContext);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);

    const currentEnv = URL.Env();

    function refreshHeaderData(env) {
        const url = API.Url("/header", env);
        fetchData(url, setInfo, setLoading, setError);
    }

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

    // TODO: clean up this styles stuff.

    const boxClass = isKnownEnv() ? "boxstyle info" : "boxstyle check-warn";
    const boxTextColor = isKnownEnv() ? "darkblue" : "#6F4E37";

    function envNameTextStyles(env) {
        return {
            fontWeight: env == currentEnv ? "bold" : "inherit"
        };
    }

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
                        <br />
                        <small>
                            {/* TODO: Use Link instead of anchor - some issue where not updating the nav links with correct URL or something */}
                            {/* though refresh (anchor rather than Link) isnt' so so bad when switching environments */}
                            Click <Link style={{fontWeight:"bold",color:"darkred"}} to={URL.Url("/env", getDefaultEnv())} onClick={() => refreshHeaderData(getDefaultEnv())}>here</Link> to use this default environment:
                            &nbsp;<Link style={{fontWeight:"bold",color:"darkred"}} to={URL.Url("/env", getDefaultEnv())} onClick={() => refreshHeaderData(getDefaultEnv())}>{getDefaultEnv()}</Link>
                        </small>
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
                                <td style={{fontWeight:isSameEnv(URL.Env(), env) ? "bold" : "normal",color:isSameEnv(URL.Env(), env) ? "black" : "inherit",verticalAlign:"top"}}><span>&#x2192;&nbsp;&nbsp;</span></td>
                                <td>
                                {/* TODO: make this a Link rather than an anchor - had some trouble previously */}
                                <span className={"tool-tip"} data-text={isSameEnv(URL.Env(), env) ? "This is the current environment." : "This is the default environment."}>
                                    <Link style={{color:isSameEnv(URL.Env(), env) ? "black" : "inherit"}} onClick={() => refreshHeaderData(env.public)} to={URL.Url("/env", env.full)}><b>{env.full}</b></Link>
                                    { isDefaultEnv(env, info) && <b style={{color:!isKnownEnv() ? "darkred" : "darkblue"}}>&nbsp;&#x272e;</b> }
                                    <br />
                                    {/* !IsAllowedEnv(env.full) && <i style={{color:"red",fontWeight:"bold"}}>You do not have permission for this environment.</i> */}
                                </span>
                                        <br />
                                        Full Name: <span style={envNameTextStyles(env.full)}>{env.full}</span> <br />
                                        Short Name: <span style={envNameTextStyles(env.short)}>{env.short}</span> <br />
                                        Public Name: <span style={envNameTextStyles(env.public)}>{env.public}</span> <br />
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

export default EnvPage;
