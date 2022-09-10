import { Navigate } from 'react-router-dom';
import { IsLoggedIn } from '../utils/LoginUtils';
import { GetCookie } from '../utils/CookieUtils';
import * as URL from "../utils/URL";

const LoginDone = (props) => {
    return <>
        { IsLoggedIn() ? (<Navigate to={GetCookie("last_url")} replace />) : (<Navigate to={URL.Url("/login", true)} replace />) }
    </>
};

export default LoginDone;
