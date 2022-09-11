import { Navigate, useLocation } from 'react-router-dom';
import { GetCookie } from '../utils/CookieUtils';
import * as URL from "../utils/URL";

const RedirectPage = () => {

    const { state } = useLocation();
    const url = state.url;
    return <Navigate to={url} replace />
};

export default RedirectPage;
