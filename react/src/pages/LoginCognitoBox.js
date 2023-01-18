import React from 'react';
import { useParams } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
import useHeader from '../hooks/Header';
import Auth0Lock from 'auth0-lock';
import Auth from '../utils/Auth';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import { FetchErrorBox } from '../Components';
import Cookie from '../utils/Cookie';
import Env from '../utils/Env';
import useFetch from '../hooks/Fetch';
import Image from '../utils/Image';
import Json from '../utils/Json';
import LiveTime from '../LiveTime';
import Logout from '../utils/Logout';
import Server from '../utils/Server';
import Tooltip from '../components/Tooltip';
import Yaml from '../utils/Yaml';
import Page from '../Page';
import Styles from '../Styles';
import { LoggedInUser, Link } from '../Components';
import { StandardSpinner } from '../Spinners';
import { Auth as AmplifyAuth } from '@aws-amplify/auth'


export const LoginCognitoBox = () => {

    const { environ } = useParams();
    const header = useHeader();

    const config = useFetch(Server.Url("/cognito/config", false),
    {
        cache: true,
        onData: (data) => {
            const configuration = {
                region: data.region,
                userPoolId: data.user_pool_id,
                userPoolWebClientId: data.client_id,
                mandatorySignIn: true,
                oauth: {
                    domain: data.domain,
                    scope: data.scope,
                    redirectSignIn: data.callback,
                    responseType: "code"
                }
            };
                console.log('cognito-config')
                console.log(configuration)
            AmplifyAuth.configure(configuration);
        }
    });

    function signinWithGoogle() {
        Cookie.Set("env", Env.PreferredName(environ, header));
        AmplifyAuth.federatedSignIn({ provider: "Google" });
    }

    function signinWithGitHub() {
        window.alert("Sign in with GitHub is not yet supported.");
    }

    return <LoginCognitoBoxWrapper>
        { config.loading ? <>
            <StandardSpinner condition={true || config.loading} color={Styles.GetForegroundColor()} bold={false} size="140" label={"Loading configuration "} />
        </>:<>
            <div style={{paddingTop:"0pt"}} />
            <GoogleLoginButton signin={signinWithGoogle} />
            <div style={{paddingTop:"6pt"}} />
            <GitHubLoginButton signin={signinWithGitHub} />
        </> }
    </LoginCognitoBoxWrapper>
}

export const LoginCognitoBoxWrapper = ({ children }) => {
    return <div className="container" style={{width:"265pt",marginTop:"30pt",marginBottom:"30pt"}}>
        <div style={{background:"#FEFEFE",border:"1px solid var(--box-fg)",border:"2px solid black",borderRadius:"6px",overflow:"hidden",width:"240pt"}}>
            <div style={{background:"var(--box-fg)",color:"var(--box-bg-lighten)",padding:"8pt 12pt 8pt 12pt",textAlign:"center"}}>
                <b className="title-font" style={{fontSize:"18pt"}}>FOURSIGHT LOGIN</b>
            </div>
            <div style={{padding:"12pt 6pt 12pt 6pt"}}>
                {children}
            </div>
        </div>
    </div>
}

const GoogleLoginButton = ({ signin }) => {
    return <LoginButtonWrapper signin={signin}>
        <img src={Image.GoogleLoginLogo()} style={{position:"relative",marginTop:"-2px"}} height="18" />
        <b className="title-font" style={{fontSize:"12pt",marginLeft:"10pt"}}>Sign in with Google</b>
    </LoginButtonWrapper>
}

const GitHubLoginButton = ({ signin }) => {
    return <LoginButtonWrapper signin={signin}>
        <img src={Image.GitHubLoginLogo()} style={{position:"relative",marginTop:"-2px",marginLeft:"-2px"}} height="20" />
        <b className="title-font" style={{fontSize:"12pt",marginLeft:"7pt"}}>Sign in with GitHub</b>
    </LoginButtonWrapper>
}

const LoginButtonWrapper = ({ signin, children }) => {
    return <div style={{background:"#FEFEFE",padding:"0 10pt 0 10pt"}}>
        <button style={{background:"lightyellow",border:"1px solid lightgray",borderRadius:"2pt",padding:"8pt 0 8pt 10pt",width:"100%",textAlign:"left",whiteSpace:"nowrap"}} onClick={signin}>
            {children}
        </button>
    </div>
}
