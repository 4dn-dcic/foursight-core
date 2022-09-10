import { Navigate, useParams } from 'react-router-dom';
import { IsLoggedIn } from '../utils/LoginUtils';
import { GetCookie } from '../utils/CookieUtils';
import * as URL from "../utils/URL";

const EnvDone = (props) => {
    const { environ } = useParams();

    // TODO: Clean this up ...
    //
    let lastUrlPath = GetCookie("last_url");
    if (!lastUrlPath) {
        lastUrlPath = "/home";
    }
    const targetUrlPath = URL.Url(URL.getLogicalPathFromUrlPath(lastUrlPath), environ);

    return <>
                {/* { IsLoggedIn() ? (<Navigate to={GetCookie("last_url")} replace />) : (<Navigate to={URL.Url("/login", true)} replace />) } */}
        { IsLoggedIn() ? (<Navigate to={targetUrlPath} replace />) : (<Navigate to={URL.Url("/login", true)} replace />) }
    </>
};

export default EnvDone;
