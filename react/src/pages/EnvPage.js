import { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Global from "../Global";
import Page from '../Page';
import AUTH from '../utils/AUTH';
import ENV from '../utils/ENV';
import CLIENT from '../utils/CLIENT';
import UUID from '../utils/UUID';

const EnvPage = (props) => {

        console.log("NOTE-LAST-URL-FROM-ENV-PAGE")
    //Page.NoteLastUrl();

    let navigate = useNavigate();
    const [ header ] = useContext(Global);

    function IsKnownCurrentEnv() {
        return ENV.IsCurrentKnown(header);
    }

    function IsCurrentEnv(env) {
        return ENV.Equals(ENV.Current(), env);
    }

    function IsDefaultEnv(env) {
        return ENV.IsDefault(env, header);
    }

    function GetDefaultEnv() {
        return ENV.PreferredName(ENV.Default(header), header);
    }

    function onChange(arg, env) {
        const environCompare = arg.target.value;
        navigate(CLIENT.Path("/gac/" + environCompare, env))
    }

    // TODO: clean up this styles stuff.

    const boxClass = IsKnownCurrentEnv() && ENV.IsCurrentAllowed(header) ? ("boxstyle info") : "boxstyle check-warn";
    const boxTextColor = IsKnownCurrentEnv() && ENV.IsCurrentAllowed(header) ? "darkblue" : "#6F4E37";

    function envNameTextStyles(env) {
        return {
            fontWeight: env === ENV.Current() ? "bold" : "inherit"
        };
    }

    // This page is unprotected.

    if (header.error) return <>Cannot load Foursight</>;
    if (header.loading) return <>Loading ...</>;
    return <div>
            { !AUTH.IsLoggedIn(header) && IsKnownCurrentEnv() ? (
                <div className="container">
                    <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:"#6F4E37"}}>
                        <b>Not Logged In</b> <br />
                        <small>
                            Click <Link to={CLIENT.Path("/login", !IsKnownCurrentEnv() ? header : true, header)} style={{cursor:"pointer",color:"#6F4E37"}}><b>here</b></Link> to go to the <Link to={CLIENT.Path("/login", !IsKnownCurrentEnv() ? header : true, header)} style={{cursor:"pointer",color:"#6F4E37"}}><b>login</b></Link> page.
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
                            {/* TODO: use short/public name with Foursight-Front but full name with Foursight-CGAP */}
                            Click <Link style={{fontWeight:"bold",color:"darkred"}} to={CLIENT.Path("/env", GetDefaultEnv())}>here</Link> to use this default environment:
                            &nbsp;<Link style={{fontWeight:"bold",color:"darkred"}} to={CLIENT.Path("/env", GetDefaultEnv())}>{GetDefaultEnv()}</Link>
                        </small>
                    </div>
                </>):(<>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    Current environment: <b style={{color:boxTextColor}}>{ENV.PreferredName(ENV.Current(), header)}</b>
                    { (AUTH.IsLoggedIn(header) && !ENV.IsAllowed(ENV.Current(), header)) && <span style={{color:"red"}}>&nbsp;&#x2192; You do not have permission for this environment.</span> }
                </div>
                </>)}
            </div>
            <div className="container">
                <b>&nbsp;Available Environments</b>
                <div className={boxClass} style={{margin:"4pt",padding:"10pt",color:boxTextColor}}>
                    <table style={{color:"inherit"}}><thead></thead><tbody>
                        {ENV.KnownEnvs(header).map((env, envIndex) =>
                            <tr key={UUID()}>
                                <td style={{fontWeight:IsCurrentEnv(env) ? "bold" : "normal",color:!IsKnownCurrentEnv(env.public_name) ? "red" : (IsCurrentEnv(env) ? "black" : "inherit"),verticalAlign:"top"}}>
                                    { IsCurrentEnv(env) ? (<>
                                        <span>&#x2192;&nbsp;&nbsp;</span>
                                    </>):(<>
                                        <span>&ndash;&nbsp;&nbsp;</span>
                                    </>)}
                                </td>
                                <td>
                                    { AUTH.IsLoggedIn(header) && !ENV.IsAllowed(env, header) ? (<>
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
                                        <select style={{border:"0",background:"transparent","WebkitAppearance":"none"}} onChange={(selected) => onChange(selected, ENV.PreferredName(env, header))}>
                                            <option>GAC Compare &#x2193;</option>
                                            { ENV.KnownEnvs(header).map((env) =>
                                                <option key={UUID()}>{ENV.PreferredName(env, header)}</option>
                                            )}
                                        </select>
                                    </>):(<>
                                    </>)}
                                    { (envIndex < ENV.KnownEnvs(header).length - 1) ? (<span>
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
