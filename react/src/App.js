import './App.css';
import { useState, useEffect, Redirect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import GlobalContext from './GlobalContext';
import { fetchData } from './FetchUtils';
import * as API from './API';
import { IsLoggedIn, LoginRequired } from './LoginUtils';
import * as URL from './URL';

import Home from './Home';
import Envs from './Envs';
import Info from './Info';
import User from './User';
import Users from './Users';
import Demo from './Demo';
import Header from './Header';
import Login from './Login';
import CompareGacs from './CompareGacs';
import Test from './Test';
import NotFound from './NotFound';
import Checks from './pages/Checks';
import { LoginAndValidEnvRequired } from './LoginUtils';

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
                    <Route path="/api/react" element={<Envs />} />
                    <Route path="/api/react/envs" element={<Envs />} />
                    <Route path="/api/react/:environ/envs" element={<Envs />} />
                    <Route path="/api/react/login" element={<Login />} />
                    <Route path="/api/react/:environ/login" element={<Login />} />
                    <Route path="/api/react/:environ" element={<LoginAndValidEnvRequired><Home /></LoginAndValidEnvRequired>} />
                    <Route path="/api/react/:environ/demo" element={<Demo />}/>
                    <Route path="/api/react/:environ/checks" element={<Checks />}/>
                    <Route path="/api/react/:environ/home" element={<LoginAndValidEnvRequired><Home /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/info" element={<LoginAndValidEnvRequired><Info /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/users" element={<LoginAndValidEnvRequired><Users/></LoginAndValidEnvRequired>} />
                    <Route path="/api/react/:environ/users/:email" element={<LoginAndValidEnvRequired><User /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/gac/:environCompare" element={<LoginAndValidEnvRequired><CompareGacs /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/test" element={<Test />}/>
                    <Route path="*" element={<NotFound />}/>
                </Routes>
            </div>
        </GlobalContext.Provider>
    </Router>
};

export default App;
