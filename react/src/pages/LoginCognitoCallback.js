import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useEffect, useContext, useState } from 'react';
import { NavLink } from 'react-router-dom';
//import HeaderData from '../HeaderData';
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
import { StandardSpinner } from '../Spinners';
import { LoggedInUser, Link } from '../Components';
import { LoginCognitoBoxWrapper } from './LoginCognitoBox';
import { useNavigate } from 'react-router-dom';

const LoginCognitoCallback = (props) => {

    const [ args ] = useSearchParams();

    const code = args.get("code");
    const state = args.get("state");
    const state_verifier = sessionStorage.getItem("oauth_state")
    const code_verifier = sessionStorage.getItem("ouath_pkce_key")

    const navigate = useNavigate();

    const url = `${Server.Url("/cognito/login", false)}?code=${code}&code_verifier=${code_verifier}&state=${state}&state_verifier=${state_verifier}`;

    const login = useFetch(url, {
        onDone: (response) => {
            const authtoken = response.data?.authtoken;
            const expires = response.data?.expires;
            Cookie.Set("authtoken", authtoken);
            const env = Cookie.Get("env");
            navigate(Client.Path(`/aws/infrastructure`, env), { replace: true })
        }
    });

    if (login.loading) {
        return <LoginCognitoBoxWrapper>
            <StandardSpinner condition={login.loading} color={Styles.GetForegroundColor()} bold={false} size={210} label={"Signing in"} />
        </LoginCognitoBoxWrapper>
    }
};

export default LoginCognitoCallback;
