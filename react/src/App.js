import { useState, useEffect } from 'react';
import { Navigate, BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HeaderData from './HeaderData';
import Env from './utils/Env';
import { useFetchFunction } from './utils/Fetch';
import Server from './utils/Server';

import AccountsPage from './pages/AccountsPage';
import AwsS3Page from './pages/aws/AwsS3Page';
import ChecksPage from './pages/ChecksPage';
import CheckHistoryPage from './pages/CheckHistoryPage';
import EnvPage from './pages/EnvPage';
import Footer from './Footer';
import ForbiddenPage from './pages/ForbiddenPage';
import Header from './Header';
import HomePage from './pages/HomePage';
import InfoPage from './pages/InfoPage';
import LoginPage from './pages/LoginPage';
import GacComparePage from './pages/GacComparePage';
import NotFoundPage from './pages/NotFoundPage';
import Page from './Page';
import RedirectPage from './pages/RedirectPage';
import Styles from './Styles';
import UserPage from './pages/UserPage';
import UserCreatePage from './pages/UserCreatePage';
import UserEditPage from './pages/UserEditPage';
import UsersPage from './pages/UsersPage';

function setGlobalStyles(header) {
    if (Env.IsFoursightFourfront(header)) {
        Styles.SetFoursightFourfront();
    }
    else {
        Styles.SetFoursightCgap();
    }
}

const App = () => {

    let [ header, setHeader ] = useState({ loading: true });
    const fetch = useFetchFunction();

    useEffect(() => {
        fetch({
            url: Server.Url("/header"),
            onData: (data) => {
                data.loading = false;
                setHeader(data);
                setGlobalStyles(data);
            },
            onDone: (response) => {
                if (response.error) {
                    setHeader(header => ({...header, ...{ error: true }}));
                }
            }
        });
    }, []);

    function getDefaultPath() {
        const env = Env.Default(header);
        const envPreferred = Env.PreferredName(env, header);
        const envRedirect = envPreferred || env;
        const path = envRedirect ? `/api/react/${envRedirect}/env` : "/api/react/env";
        return path;
    }

    return <Router>
        <HeaderData.Provider value={[header, setHeader]}>
            <Header />
            <div style={{margin:"20px"}}>
                <Routes>
                    <Route path="/api" element={
                        <Navigate to={getDefaultPath()} />
                    } />
                    <Route path="/api/react" element={
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
        </HeaderData.Provider>
    </Router>
};

export default App;
