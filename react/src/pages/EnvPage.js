import React from 'react';
import { useContext, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Global from "../Global";
import { fetchData } from '../utils/FetchUtils';
import AUTH from '../utils/AUTH';
import ENV from '../utils/ENV';
import Page from '../Page';
import SERVER from '../utils/SERVER';
import CLIENT from '../utils/CLIENT';
import UUID from '../utils/UUID';

const EnvPage = (props) => {

    Page.NoteLastUrl();

    // TODO: why not just get current env from useParams?
    // Relics of getting this kind of info from server.
    const { environ } = useParams() // TODO: use this
    let navigate = useNavigate();
    // TODO: Change this name 'info' to 'header'!
    const [ info, setInfo ] = useContext(Global);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);

    function IsKnownCurrentEnv() {
        return ENV.IsCurrentKnown(info);
    }

    function IsCurrentEnv(env) {
        return ENV.Equals(ENV.Current(), env);
    }

    function IsDefaultEnv(env) {
        return ENV.IsDefault(env, info);
    }

    function GetDefaultEnv() {
        return ENV.Default(info);
    }

    function onChange(arg, environ) {
        const environCompare = arg.target.value;
        navigate(CLIENT.Path("/gac/" + environCompare, environ))
    }

    // TODO: clean up this styles stuff.

    const boxClass = IsKnownCurrentEnv() ? "boxstyle info" : "boxstyle check-warn";
    const boxTextColor = IsKnownCurrentEnv() ? "darkblue" : "#6F4E37";

    function envNameTextStyles(env) {
        return {
            fontWeight: env == ENV.Current() ? "bold" : "inherit"
        };
    }

    // This page is unprotected.

    if (info.error) return <>Cannot load Foursight</>;
    if (info.loading) return <>Loading ...</>;
    return <div>
            { !AUTH.IsLoggedIn(info) && IsKnownCurrentEnv() ? (
                <div className="container">
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:"#6F4E37"}}>
                        <b>Not Logged In</b> <br />
                        <small>
                            Click <Link to={CLIENT.Path("/login", !IsKnownCurrentEnv() ? info : true, info)} style={{cursor:"pointer",color:"#6F4E37"}}><b>here</b></Link> to go to the <Link to={CLIENT.Path("/login", !IsKnownCurrentEnv() ? info : true, info)} style={{cursor:"pointer",color:"#6F4E37"}}><b>login</b></Link> page.
                        </small>
                        </div>
                </div>
            ):(<span/>)}
            <div className="container">
                <b>&nbsp;Environment</b>
                { !IsKnownCurrentEnv() ? (<>
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                        { (ENV.Current()) ? (<>
                            Unknown environment: <b style={{color:"darkred"}}>{ENV.Current()}</b>
                        </>):(<>
                            No environment specified in URL!
                        </>)}
                        <br />
                        <small>
                            {/* TODO: Use Link instead of anchor - some issue where not updating the nav links with correct URL or something */}
                            {/* though refresh (anchor rather than Link) isnt' so so bad when switching environments */}
                            Click <Link style={{fontWeight:"bold",color:"darkred"}} to={CLIENT.Path("/env", GetDefaultEnv())}>here</Link> to use this default environment:
                            &nbsp;<Link style={{fontWeight:"bold",color:"darkred"}} to={CLIENT.Path("/env", GetDefaultEnv())}>{GetDefaultEnv()}</Link>
                        </small>
                    </div>
                </>):(<>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    Current environment: <b style={{color:boxTextColor}}>{ENV.Current()}</b>
                    { (AUTH.IsLoggedIn(info) && !ENV.IsAllowed(ENV.Current(), info)) && <span style={{color:"red"}}>&nbsp;&#x2192; You do not have permission for this environment.</span> }
                </div>
                </>)}
            </div>
            <div className="container">
                <b>&nbsp;Available Environments</b>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    <table style={{color:"inherit"}}><thead></thead><tbody>
                        {ENV.KnownEnvs(info).map((env, envIndex) =>
                            <tr key={UUID()}>
                                <td style={{fontWeight:IsCurrentEnv(env) ? "bold" : "normal",color:!IsKnownCurrentEnv(env.public_name) ? "red" : (IsCurrentEnv(env) ? "black" : "inherit"),verticalAlign:"top"}}>
                                    { IsCurrentEnv(env) ? (<>
                                        <span>&#x2192;&nbsp;&nbsp;</span>
                                    </>):(<>
                                        <span>&ndash;&nbsp;&nbsp;</span>
                                    </>)}
                                </td>
                                <td>
                                    { AUTH.IsLoggedIn(info) && !ENV.IsAllowed(env, info) ? (<>
                                        <span className={"tool-tip"} data-text={"This is a restricted environment!"} style={{color:"red"}}>
                                            <Link style={{color:"inherit",textDecoration:IsCurrentEnv(env) ? "underline" : "normal"}} to={CLIENT.Path("/env", env.public_name)}><b>{env.public_name}</b></Link>
                                            { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            &nbsp;&#x2192; You do not have permission for this environment.
                                        </span>
                                    </>):(<>
                                        { IsCurrentEnv(env) ? (<>
                                            <span className={"tool-tip"} data-text={"This is the current environment."} style={{color:"black"}}>
                                                <Link style={{color:"inherit"}} to={CLIENT.Path("/env", env.public_name)}><b><u>{env.public_name}</u></b></Link>
                                                { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            </span>
                                        </>):(<>
                                            <span>
                                                <Link style={{color:"inherit"}} to={CLIENT.Path("/env", env.public_name)}><b>{env.public_name}</b></Link>
                                                { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            </span>
                                        </>)}
                                    </>)}
                                    <br />
                                    Full Name: <span style={envNameTextStyles(env.full_name)}>{env.full_name}</span> <br />
                                    Short Name: <span style={envNameTextStyles(env.short_name)}>{env.short_name}</span> <br />
                                    Public Name: <span style={envNameTextStyles(env.public_name)}>{env.public_name}</span> <br />
                                    GAC Name: {env.gac_name} <br />
                                    { IsKnownCurrentEnv() ? (<>
                                        <select style={{border:"0",background:"transparent","-webkit-appearance":"none"}} onChange={(selected) => onChange(selected, env.full_name)}>
                                            <option>GAC Compare &#x2193;</option>
                                            { ENV.KnownEnvs(info).map((env) =>
                                                <option key={UUID()}>{env.full_name}</option>
                                            )}
                                        </select>
                                    </>):(<>
                                    </>)}
                                    { (envIndex < ENV.KnownEnvs(info).length - 1) ? (<span>
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
