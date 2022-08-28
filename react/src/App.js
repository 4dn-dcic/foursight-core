import './App.css';
import { useState, useEffect, Redirect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import GlobalContext from './GlobalContext.js';
import { fetchData } from './FetchUtils.js';
import * as API from './API.js';
import { IsLoggedIn, LoginRequired } from './LoginUtils.js';
import * as URL from './URL.js';

import Home from './Home.js';
import Envs from './Envs.js';
import Info from './Info.js';
import User from './User.js';
import Users from './Users.js';
import Demo from './Demo.js';
import Header from './Header';
import Login from './Login';
import Test from './Test';
import NotFound from './NotFound';

const App = () => {

    let [ info, setInfo ] = useState({loading: true});
    const url = API.Url("/info", true);
    // useEffect(() => { fetchData(url, setInfo , setLoaded)}, []);
    // useEffect(() => { fetchData(url, setInfo , () => { info.loading = true; })}, []);
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
                    <Route path="/api/react/login" element={<Login />} />
                    <Route path="/api/react/:environ/login" element={<Login />} />
                    <Route path="/api/react/:environ" element={<Home />} />
                    <Route path="/api/react/:environ/demo" element={<Demo />}/>
                    <Route path="/api/react/:environ/view" element={<Home />}/>
                    <Route path="/api/react/:environ/info" element={<Info />}/>
                    <Route path="/api/react/:environ/users" element={<Users/>} />
                    <Route path="/api/react/:environ/users/:email" element={<User />}/>
                    <Route path="/api/react/:environ/test" element={<Test />}/>
                    <Route path="*" element={<NotFound />}/>
                </Routes>
            </div>
        </GlobalContext.Provider>
    </Router>
};

export default App;
