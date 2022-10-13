import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Uuid from 'react-uuid';
import HeaderData from '../HeaderData';
import Page from '../Page';
import Auth from '../utils/Auth';
import Client from '../utils/Client';
import Env from '../utils/Env';
import { useFetch, useFetchFunction } from '../utils/Fetch';
import Server from '../utils/Server';
import Type from '../utils/Type';

const EnvPage = (props) => {

    const [ header, setHeader ] = useContext(HeaderData);
    // We call the /info endpoint API just to get the GAC names.
    const response = useFetch(Auth.IsLoggedIn() ? Server.Url("/info") : null);
    const refreshHeader = useFetchFunction(Server.Url("/header"));

    Page.NoteLastUrl(header);

    function updateHeader(env) {
        refreshHeader({ onData: (data) => { setHeader(data); } });
    }

    let navigate = useNavigate();

    function IsKnownCurrentEnv() {
        return Env.IsCurrentKnown(header);
    }

    function IsCurrentEnv(env) {
        return Env.Equals(Env.Current(), env);
    }

    function IsDefaultEnv(env) {
        return Env.IsDefault(env, header);
    }

    function GetDefaultEnv() {
        return Env.PreferredName(Env.Default(header), header);
    }

    function onChange(arg, env) {
        const environCompare = arg.target.value;
        navigate(Client.Path("/gac/" + environCompare, env))
    }

    function GetGacName(env, info) {
        if (!Type.IsNonEmptyObject(info)) return "Fetching ..."
        const known_env = info.known_envs?.filter(known_env => Env.Equals(known_env, env));
        return (Type.IsNonEmptyArray(known_env) && known_env[0].gac_name) || "GAC name unknown";
    }

    function HasGacName(env, info) {
        if (!Type.IsNonEmptyObject(info)) return false;
        const known_env = info.known_envs?.filter(known_env => Env.Equals(known_env, env));
        return Type.IsNonEmptyArray(known_env) && known_env[0].gac_name;
    }

    // TODO: clean up this styles stuff.

    const boxClass = IsKnownCurrentEnv() && Env.IsCurrentAllowed(header) ? ("boxstyle info") : "boxstyle check-warn";
    const boxTextColor = IsKnownCurrentEnv() && Env.IsCurrentAllowed(header) ? "darkblue" : "#6F4E37";

    function envNameTextStyles(env) {
        return {
            fontWeight: env === Env.Current() ? "bold" : "inherit"
        };
    }

    // This page is unprotected.

    if (header.error) return <>Cannot load Foursight</>;
    if (header.loading) return <>Loading ...</>;
    return <div>
            { !Auth.IsLoggedIn(header) && IsKnownCurrentEnv() ? (
                <div className="container">
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:"#6F4E37"}}>
                        <Link to={Client.Path("/login")} style={{color:"inherit"}}><b>Not Logged In</b></Link> <br />
                        <small>
                            Click <Link to={Client.Path("/login", !IsKnownCurrentEnv() ? header : true, header)} style={{cursor:"pointer",color:"#6F4E37"}}><b><u>here</u></b></Link> to go to the <Link to={Client.Path("/login", !IsKnownCurrentEnv() ? header : true, header)} style={{cursor:"pointer",color:"#6F4E37"}}><b>login</b></Link> page.
                        </small>
                        </div>
                </div>
            ):(<span/>)}
            <div className="container">
                <b>&nbsp;Environment</b>
                { !IsKnownCurrentEnv() ? (<>
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                        { (Env.Current() && Env.Current() !== 'env') ? (<>
                            Unknown environment: <b style={{color:"darkred"}}>{Env.Current()}</b>
                        </>):(<>
                            No environment specified in URL!
                        </>)}
                        <br />
                        <small>
                            {/* TODO: use short/public name with Foursight-Front but full name with Foursight-CGAP */}
                            Click <Link to={Client.Path("/env", GetDefaultEnv())} onClick={() => updateHeader(GetDefaultEnv())} style={{fontWeight:"bold",color:"darkred"}}>here</Link> to use this default environment:
                            &nbsp;<Link to={Client.Path("/env", GetDefaultEnv())} onClick={() => updateHeader(GetDefaultEnv())} style={{fontWeight:"bold",color:"darkred"}}>{GetDefaultEnv()}</Link>
                        </small>
                    </div>
                </>):(<>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    Current environment: <b style={{color:boxTextColor}}>{Env.PreferredName(Env.Current(), header)}</b>
                    { (Auth.IsLoggedIn(header) && !Env.IsAllowed(Env.Current(), header)) && <span style={{color:"red"}}>&nbsp;&#x2192; You do not have permission for this environment.</span> }
                </div>
                </>)}
            </div>
            <div className="container">
                <b>&nbsp;Available Environments</b>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    <table style={{color:"inherit"}}><thead></thead><tbody>
                        {Env.KnownEnvs(header).map((env, envIndex) =>
                            <tr key={Uuid()}>
                                <td style={{fontWeight:IsCurrentEnv(env) ? "bold" : "normal",color:!IsKnownCurrentEnv(env.public_name) ? "red" : (IsCurrentEnv(env) ? "black" : "inherit"),verticalAlign:"top"}}>
                                    { IsCurrentEnv(env) ? (<>
                                        <span>&#x2192;&nbsp;&nbsp;</span>
                                    </>):(<>
                                        <span>&ndash;&nbsp;&nbsp;</span>
                                    </>)}
                                </td>
                                <td>
                                    { Auth.IsLoggedIn(header) && !Env.IsAllowed(env, header) ? (<>
                                        <span className={"tool-tip"} data-text={"This is a restricted environment!"} style={{color:"red"}}>
                                            <Link to={Client.Path("/env", Env.PreferredName(env, header))} onClick={() => updateHeader(Env.PreferredName(env, header))} style={{color:"inherit",textDecoration:IsCurrentEnv(env) ? "underline" : "normal"}}><b>{Env.PreferredName(env, header)}</b></Link>
                                            { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            &nbsp;&#x2192; You do not have permission for this environment.
                                        </span>
                                    </>):(<>
                                        { IsCurrentEnv(env) ? (<>
                                            <span className={"tool-tip"} data-text={"This is the current environment."} style={{color:"black"}}>
                                                <Link to={Client.Path("/env", Env.PreferredName(env, header))} onClick={() => updateHeader(Env.PreferredName(env, header))} style={{color:"inherit"}}><b><u>{Env.PreferredName(env, header)}</u></b></Link>
                                                { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            </span>
                                        </>):(<>
                                            <span>
                                                <Link to={Client.Path("/env", Env.PreferredName(env, header))} onClick={() => updateHeader(Env.PreferredName(env, header))} style={{color:"inherit"}}><b>{Env.PreferredName(env, header)}</b></Link>
                                                { IsDefaultEnv(env) && <b className={"tool-tip"} data-text={"This is the default environment."}>&nbsp;&#x272e;</b> }
                                            </span>
                                        </>)}
                                    </>)}
                                    <br />
                                    Full Name: <span style={envNameTextStyles(env.full_name)}>{env.full_name}</span> <br />
                                    Short Name: <span style={envNameTextStyles(env.short_name)}>{env.short_name}</span> <br />
                                    Public Name: <span style={envNameTextStyles(env.public_name)}>{env.public_name}</span> <br />
                                    { Auth.IsLoggedIn() && <>
                                        GAC Name: {GetGacName(env, response.data)} <br />
                                        { IsKnownCurrentEnv() && HasGacName(env, response.data) && <>
                                            <select style={{border:"0",background:"transparent","WebkitAppearance":"none"}} onChange={(selected) => onChange(selected, Env.PreferredName(env, header))}>
                                                <option>GAC Compare &#x2193;</option>
                                                { Env.KnownEnvs(header).map((env) =>
                                                    <option key={Uuid()}>{Env.PreferredName(env, header)}</option>
                                                )}
                                            </select>
                                        </>}
                                    </>}
                                    { (envIndex < Env.KnownEnvs(header).length - 1) ? (<span>
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
