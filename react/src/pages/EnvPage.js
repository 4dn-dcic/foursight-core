import { Link, useNavigate } from 'react-router-dom';
import Uuid from 'react-uuid';
import useHeaderRefresh from '../hooks/HeaderRefresh';
import { FetchErrorBox, HorizontalLine } from '../Components';
import Page from '../Page';
import Auth from '../utils/Auth';
import Client from '../utils/Client';
import Char from '../utils/Char';
import Env from '../utils/Env';
import useFetch from '../hooks/Fetch';
import Server from '../utils/Server';
import Type from '../utils/Type';
import Tooltip from '../components/Tooltip';
import useHeader from '../hooks/Header';

const EnvPage = (props) => {

    const header = useHeader();
    const refreshHeader = useHeaderRefresh(); // not sure this is actually necessary anymore

    // We call the /info endpoint API just to get the GAC names.
    const info = useFetch(Auth.IsLoggedIn() ? Server.Url("/info") : null);

    Page.NoteLastUrl(header);

    let navigate = useNavigate();

    function IsKnownCurrentEnv() {
        return Env.IsKnown(Env.Current(), header);
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

    const boxClass = IsKnownCurrentEnv() && Env.IsAllowed(Env.Current(), header) ? "box" : "box warning";

    function envNameTextStyles(env) {
        return {
            fontWeight: env === Env.Current() ? "bold" : "inherit"
        };
    }

    // This page is unprotected.

    if (header.error) return <FetchErrorBox error={header.error} message="Error loading users from Foursight API" />
    if (header.loading) return <>Loading ...</>;
    return <div>
        <div className="container">
        { !Auth.IsLoggedIn(header) && IsKnownCurrentEnv() ? (
            <div className="box warning" style={{margin:"0pt",padding:"10pt",marginBottom:"8pt"}}>
                <span className="pointer" onClick={() => navigate(Client.Path("/login?auth=1"))} style={{fontSize:"large",color:"inherit"}}><b>{Char.Warning}&nbsp;&nbsp;Not Logged In</b></span> <br />
                <HorizontalLine top="6pt" bottom="6pt" />
                <small>
                    Click <Link to={Client.Path("/login", !IsKnownCurrentEnv() ? header : true, header)} style={{cursor:"pointer",color:"inherit"}}><b><u>here</u></b></Link> to go to the <Link to={Client.Path("/login", !IsKnownCurrentEnv() ? header : true, header)} style={{cursor:"pointer",color:"inherit"}}><b>login</b></Link> page.
                </small>
                </div>
        ):(<span/>)}
        <b>Environment</b>
        { !IsKnownCurrentEnv() ? (<>
            <div className="box warning" style={{marginBottom:"8pt",padding:"10pt"}}>
                { (Env.Current() && Env.Current() !== 'env') ? (<>
                    Unknown environment: <b style={{color:"darkred"}}>{Env.Current()}</b>
                </>):(<>
                    No environment specified in URL!
                </>)}
                <br />
                <small>
                    {/* TODO: use short/public name with Foursight-Front but full name with Foursight-CGAP */}
                    Click <Link to={Client.Path("/env", GetDefaultEnv())} onClick={() => refreshHeader(GetDefaultEnv())} style={{fontWeight:"bold",color:"darkred"}}>here</Link> to use this default environment:
                    &nbsp;<Link to={Client.Path("/env", GetDefaultEnv())} onClick={() => refreshHeader(GetDefaultEnv())} style={{fontWeight:"bold",color:"darkred"}}>{GetDefaultEnv()}</Link>
                </small>
            </div>
        </>):(<>
        <div className={boxClass} style={{marginBottom:"8pt",padding:"10pt"}}>
            Current environment: <b>{Env.PreferredName(Env.Current(), header)}</b>
            { (Auth.IsLoggedIn(header) && !Env.IsAllowed(Env.Current(), header)) && <span style={{color:"red"}}>&nbsp;<b>{Char.RightArrow}</b> You do not have permission for this environment <b>{Char.Warning}</b></span> }
        </div>
        </>)}
        <b>Available Environments</b> { header.auth?.known_envs_actual_count > Env.KnownEnvs(header)?.length && <small>&nbsp;({header.auth.known_envs_actual_count})</small> }
        <div className={boxClass} style={{margin:"0pt",padding:"10pt"}}>
            <table style={{color:"inherit"}}><thead></thead><tbody>
                {Env.KnownEnvs(header).map((env, envIndex) =>
                    <tr key={Uuid()}>
                        <td style={{fontWeight:IsCurrentEnv(env) ? "bold" : "normal",color:!IsKnownCurrentEnv(env.public_name) ? "red" : (IsCurrentEnv(env) ? "black" : "inherit"),verticalAlign:"top"}}>
                            { IsCurrentEnv(env) ? (<>
                                <span id={`tooltip-env-current-check`} style={{color:Auth.IsLoggedIn(header) && !Env.IsAllowed(env, header) ? "red" : "inherit"}}>{Char.Check}&nbsp;&nbsp;</span>
                            </>):(<>
                                <span style={{color:!Env.IsAllowed(env, header) ? "red" : "inherit"}}>{Char.Dot}&nbsp;&nbsp;</span>
                            </>)}
                            <Tooltip id={`tooltip-env-current-check`} position="bottom" text="This is your current environment." />
                        </td>
                        <td>
                            { Auth.IsLoggedIn(header) && !Env.IsAllowed(env, header) ? (<>
                                <span style={{color:"red"}}>
                                    <Link id={`tooltip-env-nopermission`} to={Client.Path("/env", Env.PreferredName(env, header))} onClick={() => refreshHeader(Env.PreferredName(env, header))} style={{color:"inherit",textDecoration:IsCurrentEnv(env) ? "underline" : "normal"}}><b>{Env.PreferredName(env, header)}</b></Link>
                                    { IsDefaultEnv(env) && <span style={{color:"black"}}>&nbsp;<b>{Char.RightArrow}</b>This is the default environment {Char.Star}</span> }
                                    &nbsp;<b>{Char.RightArrow}</b> You do not have permission for this environment <b>{Char.Warning}</b>
                                    <Tooltip id={`tooltip-env-nopermission`} position="bottom" text="You do not have permission for this environment." />
                                </span>
                            </>):(<>
                                { IsCurrentEnv(env) ? (<>
                                    <span style={{color:"black"}}>
                                        <Link id={IsCurrentEnv(env) ? "tooltip-env-current" : ""} to={Client.Path("/env", Env.PreferredName(env, header))} onClick={() => refreshHeader(Env.PreferredName(env, header))} style={{color:"inherit"}}><b><u>{Env.PreferredName(env, header)}</u></b></Link>
                                        { IsDefaultEnv(env) && <span>&nbsp;<b>{Char.RightArrow}</b> This is the default environment {Char.Star}</span> }
                                    </span>
                                    <Tooltip id={`tooltip-env-current`} position="bottom" text="This is your current environment." />
                                </>):(<>
                                    <span>
                                        <Link id={`tooltip-env-default-${env.full_name}`} to={Client.Path("/env", Env.PreferredName(env, header))} onClick={() => refreshHeader(Env.PreferredName(env, header))} style={{color:"inherit"}}><b>{Env.PreferredName(env, header)}</b></Link>
                                        { IsDefaultEnv(env) && <span style={{color:"black"}}>&nbsp;<b>{Char.RightArrow}</b> This is the default environment {Char.Star}</span> }
                                        <Tooltip id={`tooltip-env-default-${env.full_name}`} position="top" text="This is the default environment." />
                                    </span>
                                </>)}
                            </>)}
                            <br />
                            Full Name: <span style={envNameTextStyles(env.full_name)}>{env.full_name}</span> <br />
                            Short Name: <span style={envNameTextStyles(env.short_name)}>{env.short_name}</span> <br />
                            Public Name: <span style={envNameTextStyles(env.public_name)}>{env.public_name}</span> <br />
                            { Auth.IsLoggedIn() && <>
                                GAC Name: {GetGacName(env, info.data)} <br />
                                { IsKnownCurrentEnv() && HasGacName(env, info.data) && <>
                                    <select style={{border:"0",background:"transparent","WebkitAppearance":"none"}} onChange={(selected) => onChange(selected, Env.PreferredName(env, header))}>
                                        <option>GAC Compare {Char.DownArrow}</option>
                                        { Env.KnownEnvs(header).map((env) =>
                                            <option key={Uuid()}>{Env.PreferredName(env, header)}</option>
                                        )}
                                    </select>
                                    <br />
                                </>}
                                {/* No break after the last item */}
                                { envIndex < Env.KnownEnvs(header).length - 1 && <br /> }
                            </>}
                        </td>
                    </tr>
                )}
            </tbody></table>
        </div>
        { Auth.IsLoggedIn(header) &&
            <div style={{marginTop:"8pt"}}>
                {/* <AccountsComponent header={header} /> */}
            </div>
        }
    </div>
    </div>
};

export default EnvPage;
