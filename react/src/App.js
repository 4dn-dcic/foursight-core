import './css/App.css';
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import GlobalContext from './GlobalContext';
import { fetchData } from './utils/FetchUtils';
import SERVER from './utils/SERVER';

import Page from './Page';
import HomePage from './pages/HomePage';
import EnvPage from './pages/EnvPage';
import InfoPage from './pages/InfoPage';
import UserPage from './pages/UserPage';
import UsersPage from './pages/UsersPage';
import DemoPage from './pages/DemoPage';
import Header from './Header';
import Footer from './Footer';
import LoginPage from './pages/LoginPage';
import GacComparePage from './pages/GacComparePage';
import TestPage from './pages/TestPage';
import NotFoundPage from './pages/NotFoundPage';
import ChecksPage from './pages/ChecksPage';
import RedirectPage from './pages/RedirectPage';

const App = () => {

    let [ header, setHeader ] = useState({loading: true});
    const url = SERVER.Url("/header");
    useEffect(() => {
        fetchData(
            url,
            data => {
                header.loading = false;
                setHeader(data);
            },
            loading => {},
            error => {
                setHeader(header => ({...header, ...{error:true}}));
            })
    }, []);

    // TODO: Move the page guards here or else the fetches with fire within the pages before they redirect if not authenticated.

    return <Router>
        <GlobalContext.Provider value={[header, setHeader]}>
            <Header />
            <div style={{margin:"20px"}}>
                <Routes>
                    <Route path="/api/react" element={
                        <EnvPage />
                    } />
                    <Route path="/api/react/:environ/env" element={
                        <EnvPage />
                    } />
                    <Route path="/api/react/:environ/login" element={
                        <Page.KnownEnvRequired>
                            <LoginPage />
                        </Page.KnownEnvRequired>
                    } />
                    <Route path="/api/react/:environ/demo" element={
                        <DemoPage />
                    }/>
                    <Route path="/api/react/:environ/checks" element={
                        <Page.AuthorizationRequired>
                            <ChecksPage />
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
                    <Route path="/api/react/:environ/test" element={
                        <TestPage />
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
        </GlobalContext.Provider>
    </Router>
};

export default App;
