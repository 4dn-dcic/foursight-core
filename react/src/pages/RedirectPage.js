import { Navigate, useLocation } from 'react-router-dom';

const RedirectPage = () => {

    const { state } = useLocation();
    let url = state.url;
    if (url.startsWith(window.location.origin)) {
        url = url.substring(window.location.origin.length);
    }
    return <Navigate to={url} replace />
};

export default RedirectPage;
