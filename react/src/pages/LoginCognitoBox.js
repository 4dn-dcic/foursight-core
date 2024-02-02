import React from 'react';
import { useParams } from 'react-router-dom';
import useHeader from '../hooks/Header';
import Cookie from '../utils/Cookie';
import Env from '../utils/Env';
import useFetch from '../hooks/Fetch';
import Image from '../utils/Image';
import Server from '../utils/Server';
import Styles from '../Styles';
import { StandardSpinner } from '../Spinners';
import { Auth as AmplifyAuth } from '@aws-amplify/auth'

const BOX_BACKGROUND = "#FEFEFE";

export const LoginCognitoBox = ({ hide }) => {

    const { environ } = useParams();
    const header = useHeader();

    const config = useFetch(Server.Url("/cognito_config", false),
    {
        cache: true,
        onData: (data) => {
            const configuration = {
                region: data.region,
                userPoolId: data.userpool,
                userPoolWebClientId: data.client,
                mandatorySignIn: true,
                oauth: {
                    domain: data.domain,
                    scope: data.scope,
                    prompt: "select_account", // DOES NOT WORK!
                    redirectSignIn: data.callback,
                    responseType: "code"
                },
            };
            // TODO/2024-02-02: Commented this out when all of a sudden ran into
            // problems with the aws-amplify package which first manifested as an
            // error like this (only) when running React locally:
            // > Module not found: Error: You attempted to import /Users/dmichaels/repos/cgap/foursight-core/react/node_modules/react-refresh/runtime.js
            // > falls outside of the project src/ directory. Relative imports outside of src/ are not supported.
            // > can either move it inside src/, or add a symlink to it from project's node_modules/.
            // > ERROR in ./src/App.js 1:40-137
            // Fixed this by changing "aws-amplify" in package.json from "^5.0.10" to "^6.0.13",
            // but then not finding "Auth" in "@aws-amplify/auth" above.
            // Since this Cognito module not currently even in use we will just comment out for now.
            // AmplifyAuth.configure(configuration);
        }
    });

    function signinWithGoogle() {
        Cookie.Set("env", Env.PreferredName(environ, header));
        Cookie.Set("signinvia", "Google");
        // AmplifyAuth.federatedSignIn({ provider: "Google", prompt: 'select_account' }, { prompt: 'select_account' });
    }

    function signinWithGitHub() {
        window.alert("Sign in with GitHub via Cognito not supported.");
    }

    const links = <div>
        <div className="title-font" style={{marginTop:"4pt",fontSize:"8pt"}}>
            <span>&nbsp;<a href="https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html" target="_blank" rel="noreferrer" style={{color:"gray"}}>Powered by AWS Cognito</a></span>
            <span className="pointer" style={{float:"right"}} onClick={hide}>Cancel&nbsp;&nbsp;</span>
        </div>
    </div>

    return <div style={{transform:"scale(1.1)",marginTop:"10pt",marginBottom:"40pt"}}>
        <LoginCognitoBoxWrapper links={links}>
            { config.loading ? <>
                <StandardSpinner condition={true || config.loading} color={Styles.GetForegroundColor()} bold={false} size="140px" label={"Loading configuration "} />
            </>:<>
                <div style={{paddingTop:"0pt"}} />
                <GoogleLoginButton signin={signinWithGoogle} />
                <div style={{paddingTop:"6pt"}} />
                <GitHubLoginButton signin={signinWithGitHub} />
            </> }
        </LoginCognitoBoxWrapper>
    </div>
}

export const LoginCognitoBoxWrapper = ({ links, children }) => {
    return <div className="container" style={{width:"265pt",marginTop:"30pt"}}>
        <div>
        <div style={{border:"2px solid var(--box-fg)",padding:"2px 2px 2px 2px",borderRadius:"6px",overflow:"hidden"}}>
            <div style={{background:BOX_BACKGROUND,border:"1px solid var(--box-fg)",borderRadius:"6px",overflow:"hidden"}}>
                <div style={{background:"var(--box-fg)",color:"var(--box-bg)",padding:"8pt 12pt 8pt 12pt",textAlign:"center"}}>
                    <b className="title-font" style={{fontSize:"18pt",color:"yellow"}}>FOURSIGHT&nbsp;&nbsp;LOGIN</b>
                </div>
                <div style={{padding:"12pt 6pt 12pt 6pt"}}>
                    {children}
                </div>
            </div>
        </div>
        { links && <>{links}</> }
        </div>
    </div>
}

const GoogleLoginButton = ({ signin }) => {
    return <LoginButtonWrapper signin={signin}>
        <img alt="google" src={Image.GoogleLoginLogo()} style={{position:"relative",marginTop:"-2px"}} height="18" />
        <b className="title-font" style={{fontSize:"12pt",marginLeft:"10pt"}}>Sign in with Google</b>
    </LoginButtonWrapper>
}

const GitHubLoginButton = ({ signin }) => {
    return <LoginButtonWrapper signin={signin}>
        <img alt="github" src={Image.GitHubLoginLogo()} style={{position:"relative",marginTop:"-2px",marginLeft:"-2px"}} height="21" />
        <b className="title-font" style={{fontSize:"12pt",marginLeft:"7pt"}}>Sign in with GitHub</b>
    </LoginButtonWrapper>
}

const LoginButtonWrapper = ({ signin, children }) => {
    return <div style={{background:BOX_BACKGROUND,padding:"0 10pt 0 10pt"}}>
        <button className="signin-as-button" onClick={signin}>
            {children}
        </button>
    </div>
}
