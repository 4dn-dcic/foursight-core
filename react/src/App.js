import { useState, useEffect } from 'react';
import { Navigate, BrowserRouter as Router, Routes, Route } from 'react-router-dom';
//import HeaderData from './HeaderData';
import Env from './utils/Env';
//import useFetchFunction from './hooks/FetchFunction';
import Server from './utils/Server';

import AccountsPage from './pages/AccountsPage';
import AwsS3Page from './pages/aws/AwsS3Page';
import ChecksPage from './pages/ChecksPage';
import CheckHistoryPage from './pages/CheckHistoryPage';
import Client from './utils/Client';
import EnvPage from './pages/EnvPage';
import Footer from './Footer';
import ForbiddenPage from './pages/ForbiddenPage';
import Header from './Header';
import HomePage from './pages/HomePage';
import InfoPage from './pages/InfoPage';
import LoginPage from './pages/LoginPage';
import LoginCognitoCallback from './pages/LoginCognitoCallback';
import GacComparePage from './pages/GacComparePage';
import InfrastructurePage from './pages/aws/InfrastructurePage';
import NotFoundPage from './pages/NotFoundPage';
import Page from './Page';
import RedirectPage from './pages/RedirectPage';
import Styles from './Styles';
import UserPage from './pages/UserPage';
import UserCreatePage from './pages/UserCreatePage';
import UserEditPage from './pages/UserEditPage';
import UsersPage from './pages/UsersPage';

import HeaderProvider from './hooks/HeaderProvider';
import useHeader from './hooks/Header';
import Context from './utils/Context';
import { useSearchParams } from 'react-router-dom';

/*
function setGlobalStyles(header) {
    if (Env.IsFoursightFourfront(header)) {
        Styles.SetFoursightFourfront();
    }
    else if (Env.IsFoursightCgap(header)) {
        Styles.SetFoursightCgap();
    }
    else {
        Styles.SetFoursightCgap();
    }
}
*/

const App = () => {

    // let [ header, setHeader ] = useState({ loading: true });
    // const fetch = useFetchFunction();

        /*
    useEffect(() => {
        fetch({
            url: Server.Url("/header"),
            onData: (data) => {
                data.loading = false;
                setHeader(data);
                setGlobalStyles(data);
            },
            onError: (response) => {
                setHeader(header => ({...header, ...{ error: true }}))
            }
        });
    }, []);
    */

        //const header = useHeader();

    const header = useHeader();

    function getDefaultPath() {
        return `/api/react/${Env.PreferredName(Env.Default(header))}/login`;
            /*
        const env = Env.Default(header);
        const envPreferred = Env.PreferredName(env, header);
        const envRedirect = envPreferred || env;
        const path = envRedirect ? `/api/react/${envRedirect}/env` : "/api/react/env";
        return path;
        */
    }

        console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxy')
        console.log(Client.Path());
        console.log(Client.CurrentLogicalPath());
        console.log(Context.Client.CurrentPath());
        console.log(window.location)

    // if (window.location.pathname=== "/callback") { // OK
      //       console.log("GOOOOOOOOOOOOOOOOOOOOOOOOOOOOOO")
        //             return;
    // }

    // if (window.location.pathname=== "/callback") { // OK
    if (window.location.pathname=== "/api/react/oauth/callback") { // OK
        console.log('IOOO xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxy')
        console.log(window.location.search)
        const code = "asdf"; // args.get("code");
        const state = "asdf"; // args.get("state");
        const ouath_pkce_key = sessionStorage.getItem("ouath_pkce_key");
        const oauth_state = sessionStorage.getItem("oauth_state");
        // const url = `http://localhost:8000/callback?code=${code}&state=${state}&oauth_state=${oauth_state}&ouath_pkce_key=${ouath_pkce_key}`;
        const url = `http://localhost:8000/callback${window.location.search}&oauth_state=${oauth_state}&ouath_pkce_key=${ouath_pkce_key}`;
            console.log(url)
            return
    }
    if (window.location.pathname=== "/api/oauth/callback") { // OK
        console.log('FOOO xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxy')
        console.log(window.location.search)
        const code = "asdf"; // args.get("code");
        const state = "asdf"; // args.get("state");
        const ouath_pkce_key = sessionStorage.getItem("ouath_pkce_key");
        const oauth_state = sessionStorage.getItem("oauth_state");
        // const url = `http://localhost:8000/callback?code=${code}&state=${state}&oauth_state=${oauth_state}&ouath_pkce_key=${ouath_pkce_key}`;
        const url = `http://localhost:8000/callback${window.location.search}&oauth_state=${oauth_state}&ouath_pkce_key=${ouath_pkce_key}`;
            console.log(url)
            // window.location.href = url;
            return
    }

    return <Router>
        <HeaderProvider>
            <Header />
            <div style={{margin:"14pt"}}>
                <Routes>
                    <Route path="/api/react/cognito/callback" element={
                        <LoginCognitoCallback />
                    }/>
                    <Route path="/" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api/react" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api/react/:environ" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api/react/:environ/accounts" element={
                        <Page.AuthorizationRequired>
                            <AccountsPage />
                        </Page.AuthorizationRequired>
                    } />
                    <Route path="/api/react/:environ/env" element={
                        <EnvPage />
                    } />
                    <Route path="/api/react/env" element={
                        <EnvPage />
                    } />
                    <Route path="/api/react/:environ/login" element={
                        <Page.KnownEnvRequired>
                            <LoginPage />
                        </Page.KnownEnvRequired>
                    } />
                    <Route path="/api/react/:environ/checks" element={
                        <Page.AuthorizationRequired>
                            <ChecksPage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/checks/:check/history" element={
                        <Page.AuthorizationRequired>
                            <CheckHistoryPage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/home" element={
                        <Page.AuthorizationRequired>
                            <HomePage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/info" element={
                        <Page.AuthorizationRequired>
                            <InfoPage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/users" element={
                        <Page.AuthorizationRequired>
                            <UsersPage />
                        </Page.AuthorizationRequired>
                    } />
                    <Route path="/api/react/:environ/users/:email" element={
                        <Page.AuthorizationRequired>
                            <UserPage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/users/edit/:uuid" element={
                        <Page.AuthorizationRequired>
                            <UserEditPage />
                        </Page.AuthorizationRequired>
                    } />
                    <Route path="/api/react/:environ/users/create" element={
                        <Page.AuthorizationRequired>
                            <UserCreatePage />
                        </Page.AuthorizationRequired>
                    } />
                    <Route path="/api/react/:environ/gac/:environCompare" element={
                        <Page.AuthorizationRequired>
                            <GacComparePage />
                        </Page.AuthorizationRequired>
                    }>
                    </Route>
                    <Route path="/api/react/:environ/aws/s3" element={
                        <Page.AuthorizationRequired>
                            <AwsS3Page />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/aws/infrastructure" element={
                        <Page.AuthorizationRequired>
                            <InfrastructurePage />
                        </Page.AuthorizationRequired>
                    }/>
                    <Route path="/api/react/:environ/forbidden" element={
                        <ForbiddenPage />
                    }/>
                    <Route path="/redirect" element={
                        <RedirectPage />
                    }/>
                    <Route path="*" element={
                        <Page.AuthorizationRequired>
                            <NotFoundPage />
                        </Page.AuthorizationRequired>
                    }/>
                </Routes>
            </div>
            <Footer />
         </HeaderProvider>
    </Router>
};

export default App;
