import { useState, useEffect } from 'react';
import { Navigate, BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Global from './Global';
import Env from './utils/Env';
import Fetch from './utils/Fetch';
import Image from './utils/Image';
import Server from './utils/Server';

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
import TestPage from './pages/TestPage';
import UserPage from './pages/UserPage';
import UsersPage from './pages/UsersPage';

function setFavicon(header) {
    const faviconElement = document.getElementById("favicon");
    if (faviconElement) {
        if (Env.IsFoursightFourfront(header)) {
            faviconElement.href = Image.FoursightFourfrontFavicon();
        }
        else {
            faviconElement.href = Image.FoursightCgapFavicon();
        }
    }
}

const App = () => {

    let [ header, setHeader ] = useState({loading: true});

    const url = Server.Url("/header");
    useEffect(() => {
        Fetch.get(
            url,
            data => {
                data.loading = false;
                setHeader(data);
                setFavicon(data);
            },
            loading => {},
            error => {
                setHeader(header => ({...header, ...{error:true}}));
            })
    }, []);

    return <Router>
        <Global.Provider value={[header, setHeader]}>
            <Header />
            <div style={{margin:"20px"}}>
                <Routes>
                    <Route path="/api/react" element={
                        <Navigate to={"/api/react/env"} />
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
                    <Route path="/api/react/:environ/test" element={
                        <TestPage />
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
        </Global.Provider>
    </Router>
};

export default App;
