import { useContext, useState } from 'react';
import React from 'react';
import Env from '../utils/Env';
import Server from '../utils/Server';
import Styles from '../Styles';
import useFetch from './Fetch';
//
// TODO: Why doesn't this work ...
//
// import useFetcher from './Fetcher';
//
// Fetch.js:3 Uncaught ReferenceError: Cannot access 'useFetcher' before initialization
// at Module.useFetcher (Fetch.js:3:1)
// at ./src/hooks/Fetcher.js (Fetcher.js:3:1)
//
import { useFetcher } from './FetchBase';

// This is the global header data from the React API /header call.
// export const HeaderData = React.createContext(null);
//
import HeaderData from '../HeaderData';

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

export const useHeader = () => {
    const header = useContext(HeaderData);
    return header ? header[0] : null;
}

export const useHeaderRefresh = () => {
    const [ _, setHeader ] = useContext(HeaderData);
    const fetcher = useFetcher();
    return (env) => {
        fetcher.refresh(Server.Url("/header", env), { onData: (data) => setHeader(data), cache: true });
    }
}

// export default HeaderData;
