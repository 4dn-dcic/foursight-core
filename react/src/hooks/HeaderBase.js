import { useContext, useState } from 'react';
import React from 'react';
import Env from '../utils/Env';
import Server from '../utils/Server';
import Styles from '../Styles';
import useFetch from './Fetch';
import useFetcher from './Fetcher';

// This is the actual global header data definition, which will be populated from
// the API /header fetch in the "provider" below. This may be shared globally
// across all components in our app via the useHeader hook defined here.
//
export const HeaderData = React.createContext({});

// This the "provider" component for our global header data, which should be wrapped
// around our ENTIRE app in order for ANY component within our app to reference this
// global header data, i.e. via the useHeader hook defined here.
//
export const HeaderProvider = ({ children }) => {

    let [ header, setHeader ] = useState({ loading: true });

    // Call our API /header endpoint to get the global
    // header data (for the current environment).
    //
    useFetch("/header", {
        onData: (header) => {
            header.loading = false;
            setHeader(header);
            //
            // Here we set the global styles based on the site type, i.e. Foursight-CGAP
            // vs. Foursight-Fourfront, which is determined from the fetched header data;
            // The former is a blue-ish color-schema and green-ish for the latter.
            //
            if (Env.IsFoursightFourfront(header)) {
                Styles.SetFoursightFourfront();
            }
            else if (Env.IsFoursightCgap(header)) {
                Styles.SetFoursightCgap();
            }
            else if (Env.IsFoursightSmaht(header)) {
                Styles.SetFoursightSmaht();
            }
            else {
                Styles.SetFoursightCgap();
            }
        },
        onError: (response) => {
            setHeader(header => ({ ...header, ...{ error: true } }));
        },
        cache: true
    });

    // This "provider" is what ties our HeaderData, defined globally above, with our
    // actual header state, fetched and stored locally above in the header/setHeader
    // state; so that any children components get get access to it, via userHeader().
    //
    return <HeaderData.Provider value={ [ header, setHeader ] }>
        {children}
    </HeaderData.Provider>
}

// This is the hook which should be used by any component which wants to referent our global header data.
// E.g. const header = useHeader();
//      const version = header.app?.version;
//
export const useHeader = () => {
    const header = useContext(HeaderData);
    return header ? header[0] : {};
}

// This hook can be used to explicitly/manually refresh the global header data;
// useful when the user switches environments via the UI as the header is per-environment.
// E.g. const headerRefresher = useHeaderRefresh();
//      headerRefresher(env);
//
export const useHeaderRefresh = () => {
    const [ _, setHeader ] = useContext(HeaderData);
    const fetcher = useFetcher();
    return (env) => fetcher.refresh(Server.Url("/header", env), { onData: (data) => setHeader(data), cache: true });
}
