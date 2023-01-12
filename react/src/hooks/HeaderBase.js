import { useContext, useState } from 'react';
import React from 'react';
import Env from '../utils/Env';
import Server from '../utils/Server';
import Styles from '../Styles';
import useFetch from './Fetch';
//
// TODO: Why doesn't this work ...
// import useFetcher from './Fetcher';
// Fetch.js:3 Uncaught ReferenceError: Cannot access 'useFetcher' before initialization
// at Module.useFetcher (Fetch.js:3:1) at ./src/hooks/Fetcher.js (Fetcher.js:3:1)
//
import { useFetcher } from './FetchBase';

// This is the actual global header data definition,
// which will be populated from our React API /header call.
//
export const HeaderData = React.createContext(null);

//
//import HeaderData from '../HeaderData';

// This the "provider" component for our global header data, which should be wrapped
// around our ENTIRE app in order for ANY component within our app to reference this
// global header data, i.e. via the userHeader hook defined here.
//
export const HeaderProvider = ({ children }) => {

    let [ header, setHeader ] = useState({ loading: true });

    useFetch("/header", {
        onData: (header) => {
            header.loading = false;
            setHeader(header);
            setGlobalStyles(header);
        },
        onError: (response) => {
            setHeader(header => ({ ...header, ...{ error: true } }));
        },
        cache: true
    });

    const setGlobalStyles = () => {
        Env.IsFoursightFourfront(header)
            ? Styles.SetFoursightFourfront()
            : Styles.SetFoursightCgap();
    }

    return <HeaderData.Provider value={ [ header, setHeader ] }>
        {children}
    </HeaderData.Provider>
}

// This is the hook which should be used by any component which wants to referent our global header data.
//
export const useHeader = () => {
    const header = useContext(HeaderData);
    return header ? header[0] : null;
}

// This hook can be used to explicitly/manually refresh the global header data.
//
export const useHeaderRefresh = () => {
    const [ _, setHeader ] = useContext(HeaderData);
    const fetcher = useFetcher();
    return (env) => {
        fetcher.refresh(Server.Url("/header", env), { onData: (data) => setHeader(data), cache: true });
    }
}

// export default HeaderData;
