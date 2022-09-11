import { Navigate, useLocation } from 'react-router-dom';
import { GetCookie } from '../utils/CookieUtils';
import * as URL from "../utils/URL";

const RedirectPage = () => {

    const { state } = useLocation();

    let url = state.url;
    if (url === "last") {
        url = GetCookie("last_url");
    }
    if (!url) {
        url = URL.Url("/home", URL.Env());
    }

    return <Navigate to={url} replace />
};

export default RedirectPage;
