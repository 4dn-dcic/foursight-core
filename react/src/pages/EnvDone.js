import { Navigate, useLocation, useParams } from 'react-router-dom';
import { IsLoggedIn } from '../utils/LoginUtils';
import { GetCookie } from '../utils/CookieUtils';
import * as URL from "../utils/URL";

const EnvDone = (props) => {
        console.log('envdone')
        console.log(props)
    const { environ } = useParams();

        console.log('useLocation()');
        console.log(useLocation());
        const { state, search } = useLocation(); 
        console.log('gotoooooooooooooooooooooooooooooo')
        console.log(state.url)
        console.log(search)
        //console.log(location.url)
        //console.log("ffffffffffffffffffffffffffffff");
        //console.log(params);
        //console.log(search);

    // TODO: Clean this up ...
    //
    let lastUrlPath = GetCookie("last_url");
    if (!lastUrlPath) {
        lastUrlPath = "/home";
    }
    const targetUrlPath = URL.Url(URL.getLogicalPathFromUrlPath(lastUrlPath), environ);
        console.log('window....................');
        console.log(window);
        console.log(window.location);
        console.log(window.location.pathname);
        console.log(window.location);
        console.log(window.location.pathname);
        console.log('............window');

    return <>
                {/* { IsLoggedIn() ? (<Navigate to={GetCookie("last_url")} replace />) : (<Navigate to={URL.Url("/login", true)} replace />) } */}
        { IsLoggedIn() ? (<Navigate to={targetUrlPath} replace />) : (<Navigate to={URL.Url("/login", true)} replace />) }
    </>
};

export default EnvDone;
