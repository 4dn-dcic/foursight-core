import React from 'react';
import { useContext, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import GlobalContext from "../GlobalContext.js";
import { IsLoggedIn, NotePageLastVisited, IsAllowedEnv, IsSameEnv } from "../utils/LoginUtils";
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

    function refreshHeaderData(env) {
        const url = API.Url("/header", env);
        fetchData(url, setInfo, setLoading, setError);
    }

    function IsKnownEnv(env = URL.Env()) {
        if (!env) return false;
        env = env.toLowerCase();
        for (let i = 0 ; i < info.envs?.unique_annotated?.length ; i++) {
            const env_annotated = info.envs?.unique_annotated[i];
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

    function IsCurrentEnv(env) {
        return IsSameEnv(URL.Env(), env);
    }

    function IsDefaultEnv(env) {
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

    function getDefaultEnv() {
        return info?.env?.default;
    }

    function onChange(arg, environ) {
        const environCompare = arg.target.value;
        navigate(URL.Url("/gac/" + environCompare, environ))
    }

    // TODO: clean up this styles stuff.

    const boxClass = IsKnownEnv() ? "boxstyle info" : "boxstyle check-warn";
    const boxTextColor = IsKnownEnv() ? "darkblue" : "#6F4E37";

    function envNameTextStyles(env) {
        return {
            fontWeight: env == URL.Env() ? "bold" : "inherit"
        };
    }

    // This page is unprotected.

    if (info.error) return <>Cannot load Foursight</>;
    if (info.loading) return <>Loading ...</>;
    return <div>
            { false && !IsLoggedIn() ? (
                <div className="container">
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:"#6F4E37"}}>
                        <b>Not Logged In</b> <br />
                        <small>
                            Click <Link to={URL.Url("/login", !IsKnownEnv() ? getDefaultEnv() : true, info)} style={{cursor:"pointer",color:"#6F4E37"}}><b>here</b></Link> to go to the <Link to={URL.Url("/login", !IsKnownEnv() ? getDefaultEnv() : true, info)} style={{cursor:"pointer",color:"#6F4E37"}}><b>login</b></Link> page.
                        </small>
                        </div>
                </div>
            ):(<span/>)}
            <div className="container">
                <b>&nbsp;Environment</b>
                { !IsKnownEnv() ? (<>
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                        { (URL.Env()) ? (<>
                            Unknown environment: <b style={{color:"darkred"}}>{URL.Env()}</b>
                        </>):(<>
                            No environment specified (in URL)!
                        </>)}
                        <br />
                        <small>
                            {/* TODO: Use Link instead of anchor - some issue where not updating the nav links with correct URL or something */}
                            {/* though refresh (anchor rather than Link) isnt' so so bad when switching environments */}
                            Click <Link style={{fontWeight:"bold",color:"darkred"}} to={URL.Url("/env", getDefaultEnv())} onClick={() => refreshHeaderData(getDefaultEnv())}>here</Link> to use this default environment:
                            &nbsp;<Link style={{fontWeight:"bold",color:"darkred"}} to={URL.Url("/env", getDefaultEnv())} onClick={() => refreshHeaderData(getDefaultEnv())}>{getDefaultEnv()}</Link>
                        </small>
                    </div>
                </>):(<>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    Current environment: <b style={{color:boxTextColor}}>{URL.Env()}</b>
                    { (!IsAllowedEnv(URL.Env())) && <span style={{color:"red"}}>&nbsp;&#x2192; You do not have permission for this environment.</span> }
                </div>
                </>)}
            </div>
            <div className="container">
                <b>&nbsp;Available Environments</b>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    <table style={{color:"inherit"}}><thead></thead><tbody>
                        {info?.envs?.unique_annotated.map((env, envIndex) =>
                            <tr key={UUID()}>
                                <td style={{fontWeight:IsCurrentEnv(env) ? "bold" : "normal",color:!IsKnownEnv(env.public_name) ? "red" : (IsCurrentEnv(env) ? "black" : "inherit"),verticalAlign:"top"}}><span>&#x2192;&nbsp;&nbsp;</span></td>
                                <td>
                                    { !IsAllowedEnv(env) ? (<>
                                        <span className={"tool-tip"} data-text={"This is a restricted environment!"} style={{color:"red"}}>
                                            <Link style={{color:"inherit"}} onClick={() => refreshHeaderData(env.public)} to={URL.Url("/env", env.public)}><b>{env.public}</b></Link>
                                            { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            &nbsp;&#x2192; You do not have permission for this environment.
                                        </span>
                                    </>):(<>
                                        { IsCurrentEnv(env) ? (<>
                                            <span className={"tool-tip"} data-text={"This is the current environment."} style={{color:"black"}}>
                                                <Link style={{color:"inherit"}} onClick={() => refreshHeaderData(env.public)} to={URL.Url("/env", env.public)}><b>{env.public}</b></Link>
                                                { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            </span>
                                        </>):(<>
                                            <span>
                                                <Link style={{color:"inherit"}} onClick={() => refreshHeaderData(env.public)} to={URL.Url("/env", env.public)}><b>{env.public}</b></Link>
                                                { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            </span>
                                        </>)}
                                    </>)}
                                    <br />
                                    Full Name: <span style={envNameTextStyles(env.full)}>{env.full}</span> <br />
                                    Short Name: <span style={envNameTextStyles(env.short)}>{env.short}</span> <br />
                                    Public Name: <span style={envNameTextStyles(env.public)}>{env.public}</span> <br />
                                    GAC Name: {env.gac_name} <br />
                                    { IsKnownEnv() ? (<>
                                        <select style={{border:"0",background:"transparent","-webkit-appearance":"none"}} onChange={(selected) => onChange(selected, env.full)}>
                                            <option>GAC Compare &#x2193;</option>
                                            { info.envs?.unique_annotated.map((env) =>
                                                <option key={UUID()}>{env.full}</option>
                                            )}
                                        </select>
                                    </>):(<>
                                    </>)}
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
