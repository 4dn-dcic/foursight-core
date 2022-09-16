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
                    <Route path="/api/react" element={<EnvPage />} />
                    <Route path="/api/react/:environ/env" element={<EnvPage />} />
                    <Route path="/api/react/:environ/login" element={<LoginPage />} />
                    <Route path="/api/react/:environ/demo" element={<DemoPage />}/>
                    <Route path="/api/react/:environ/checks" element={<ChecksPage />}/>
                    <Route path="/api/react/:environ/home" element={<HomePage />}/>
                    <Route path="/api/react/:environ/info" element={<InfoPage />}/>
                    <Route path="/api/react/:environ/users" element={<UsersPage />} />
                    <Route path="/api/react/:environ/users/:email" element={<UserPage />}/>
                    <Route path="/api/react/:environ/gac/:environCompare" element={<Page.AuthorizationRequired><GacComparePage /></Page.AuthorizationRequired>}/>
                    <Route path="/api/react/:environ/test" element={<TestPage />}/>
                    <Route path="/redirect" element={<RedirectPage />}/>
                    <Route path="*" element={<NotFoundPage />}/>
                </Routes>
            </div>
            <Footer />
        </GlobalContext.Provider>
    </Router>
};

export default App;
