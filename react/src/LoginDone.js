import { Navigate } from 'react-router-dom';
import { IsLoggedIn } from './LoginUtils.js';
import { GetCookie } from './CookieUtils';
import * as URL from "./URL";

const LoginDone = (props) => {
    return <>
        { IsLoggedIn() ? (<Navigate to={GetCookie("last_url")} replace />) : (<Navigate to={URL.Url("/login", true)} replace />) }
    </>
};

export default LoginDone;
