import React from 'react';
import { useContext } from 'react';
import GlobalContext from "./GlobalContext.js";
import { LoginRequired } from "./LoginUtils.js";
import * as URL from './URL';

const Envs = (props) => {

    const [ info ] = useContext(GlobalContext);

    function isDefaultEnv(env, info) {
        const defaultEnv = info?.environ["ENV_NAME"]?.toUpperCase();
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

    // This page is unprotected.

    if (info.loading) return <>Loading ...</>;
    return <div>
            <div className="container">
                <b>&nbsp;Environments</b>
                { (info.env_unknown || URL.Env() == "") ? (<React.Fragment>
                <div className="boxstyle check-warn" style={{margin:"4pt",padding:"10pt",color:"#6F4E37"}}>
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
                                <a href={URL.Url(null, env.full)}> <b style={{color:"#6F4E37"}}>{env.full}</b></a>
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
                </div>
                </React.Fragment>):(<React.Fragment>
                <div className="boxstyle info" style={{margin:"4pt",padding:"10pt",color:"darkblue"}}>
                    Current environment: <b style={{color:"darkblue"}}>{info?.app?.env}</b>
                    <br />
                    <small>
                        <div style={{height:"1px",marginTop:"10px",marginBottom:"10px",background:"darkblue"}}></div>
                        All known environments are listed below: <br />
                        {info?.envs?.unique_annotated.map((env) =>
                            <span key={env.full}>&#x2192;&nbsp;&nbsp;
                                <a href={URL.Url(null, env.full)}><b style={{color:"darkblue"}}>{env.full}</b></a>
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
                </div>
                </React.Fragment>)}
            </div>
        <hr />
    </div>
};

export default Envs;
