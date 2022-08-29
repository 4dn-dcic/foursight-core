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
import Test from './Test';
import NotFound from './NotFound';
import { LoginAndValidEnvRequired } from './LoginUtils';

const App = () => {

    let [ info, setInfo ] = useState({loading: true});
    const url = API.Url("/info", true);
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
                    <Route path="/api/react/envs" element={<Envs />} />
                    <Route path="/api/react/:environ/envs" element={<Envs />} />
                    <Route path="/api/react/login" element={<Login />} />
                    <Route path="/api/react/:environ/login" element={<Login />} />
                    <Route path="/api/react/:environ" element={<LoginAndValidEnvRequired><Home /></LoginAndValidEnvRequired>} />
                    <Route path="/api/react/:environ/demo" element={<Demo />}/>
                    <Route path="/api/react/:environ/home" element={<LoginAndValidEnvRequired><Home /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/view" element={<LoginAndValidEnvRequired><Home /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/info" element={<LoginAndValidEnvRequired><Info /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/users" element={<LoginAndValidEnvRequired><Users/></LoginAndValidEnvRequired>} />
                    <Route path="/api/react/:environ/users/:email" element={<LoginAndValidEnvRequired><User /></LoginAndValidEnvRequired>}/>
                    <Route path="/api/react/:environ/test" element={<Test />}/>
                    <Route path="*" element={<NotFound />}/>
                </Routes>
            </div>
        </GlobalContext.Provider>
    </Router>
};

export default App;
