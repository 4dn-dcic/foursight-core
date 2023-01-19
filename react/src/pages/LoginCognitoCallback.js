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
    const state_verifier = sessionStorage.getItem("oauth_state")
    const code_verifier = sessionStorage.getItem("ouath_pkce_key")

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
            navigate(redirect_url);
        }
    });

    if (callback.loading) {
        return <LoginCognitoBoxWrapper>
            <StandardSpinner condition={callback.loading} color={Styles.GetForegroundColor()} bold={false} size={210} label={"Signing in"} />
        </LoginCognitoBoxWrapper>
    }
};

export default LoginCognitoCallback;
