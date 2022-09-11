import './css/App.css';
import { useState, useEffect, Redirect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import GlobalContext from './GlobalContext';
import { fetchData } from './utils/FetchUtils';
import * as API from './utils/API';
import { IsLoggedIn, LoginRequired } from './utils/LoginUtils';
import * as URL from './utils/URL';

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
import { LoginAndValidEnvRequired } from './utils/LoginUtils';

const App = () => {

    // TODO: Change this name 'info' to 'header'!
    let [ info, setInfo ] = useState({loading: true});
    const url = API.Url("/header", true);
    useEffect(() => {
        fetchData(
            url,
            data => {
                info.loading = false;
                setInfo(data);
            },
            loading => {},
            error => {
                setInfo(info => ({...info, ...{error:true}}));
            })
    }, []);

    return <Router>
        <GlobalContext.Provider value={[info, setInfo]}>
            <Header />
            <div style={{margin:"20px"}}>
                <Routes>
                    <Route path="/api/react" element={<EnvPage />} />
                    <Route path="/api/react/env" element={<EnvPage />} />
                    <Route path="/api/react/:environ/env" element={<EnvPage />} />
                    <Route path="/api/react/login" element={<LoginPage />} />
                    <Route path="/api/react/:environ/login" element={<LoginPage />} />
                    <Route path="/api/react/:environ" element={<LoginAndValidEnvRequired><HomePage /></LoginAndValidEnvRequired>} />
                    <Route path="/api/react/:environ/demo" element={<DemoPage />}/>
                    <Route path="/api/react/:environ/checks" element={<ChecksPage />}/>
                    <Route path="/api/react/:environ/home" element={<LoginAndValidEnvRequired><HomePage /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/info" element={<LoginAndValidEnvRequired><InfoPage /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/users" element={<LoginAndValidEnvRequired><UsersPage /></LoginAndValidEnvRequired>} />
                    <Route path="/api/react/:environ/users/:email" element={<LoginAndValidEnvRequired><UserPage /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/gac/:environCompare" element={<LoginAndValidEnvRequired><GacComparePage /></LoginAndValidEnvRequired>}/>
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
