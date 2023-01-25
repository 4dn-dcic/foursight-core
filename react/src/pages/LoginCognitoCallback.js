import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Client from '../utils/Client';
import Cookie from '../utils/Cookie';
import useFetch from '../hooks/Fetch';
import Str from '../utils/Str';
import Server from '../utils/Server';
import Styles from '../Styles';
import Path from '../utils/Path';
import { StandardSpinner } from '../Spinners';
import { LoginCognitoBoxWrapper } from './LoginCognitoBox';
import { useNavigate } from 'react-router-dom';

const LoginCognitoCallback = (props) => {

    const [ args ] = useSearchParams();

    const code = args.get("code");
    const state = args.get("state");
    //
    // These values are written by our call to AmplifyAuth.federatedSignIn in LoginCognitoBox.
    // We pass these to our /cognito/callback endpoint (below), which in turn passes them to
    // the Cognito /oauths/token endpoint call. We delete them when done for extra security.
    //
    const state_verifier = sessionStorage.getItem("oauth_state");
    const code_verifier = sessionStorage.getItem("ouath_pkce_key");

    const navigate = useNavigate();

    const url = `${Server.Url("/cognito/callback", false)}?code=${code}&code_verifier=${code_verifier}&state=${state}&state_verifier=${state_verifier}`;

    const callback = useFetch(url, {
        onDone: (response) => {
            const authtoken = response.data?.authtoken;
            const expires = response.data?.expires;
            Cookie.Set("authtoken", authtoken, expires);
            let redirect_url = Cookie.Redirect();
            if (Str.HasValue(redirect_url)) {
                redirect_url = Path.FromUrl(redirect_url);
            }
            else {
                redirect_url = Cookie.LastUrl();
                if (Str.HasValue(redirect_url)) {
                    redirect_url = Path.FromUrl(redirect_url);
                }
                else {
                    const env = Cookie.Get("env");
                    redirect_url = Client.Path("/home", env);
                }
            }
            //
            // These are no longer needed; delete them for
            // an extra measure of security; see above comment.
            //
            sessionStorage.removeItem("oauth_state");
            sessionStorage.removeItem("ouath_pkce_key");
            navigate(redirect_url);
        }
    });

    if (callback.loading) {
        const signinvia = Cookie.Get("signinvia");
        return <div style={{transform:"scale(1.1)",marginTop:"10pt",marginBottom:"40pt"}}>
            <LoginCognitoBoxWrapper>
                <StandardSpinner condition={callback.loading} color={Styles.GetForegroundColor()} bold={false} size={140} label={`Signing in via ${signinvia}`} />
            </LoginCognitoBoxWrapper>
        </div>
    }
};

export default LoginCognitoCallback;
