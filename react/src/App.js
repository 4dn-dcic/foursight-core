import './App.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { useState, useEffect} from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from './Home.js';
import Info from './Info.js';
import User from './User.js';
import Users from './Users.js';
import Demo from './Demo.js';
import Header from './Header';
import { fetchData } from './Utils.js';
import GlobalContext from "./GlobalContext.js";


const App = () => {

    let [ info, setInfo ] = useState({loading: true});
    let [ loading, setLoading ] = useState(true);
    const url = "http://localhost:8000/api/reactapi/cgap-supertest/info"
    useEffect(() => { fetchData(url, setInfo, setLoading)}, []);

    return (<div>
        <Router>
            <GlobalContext.Provider value={info}>
            <Header />
            <Routes>
                <Route path="/api/react/:environ" element={<Home />} />
                <Route path="/api/react/:environ/demo" element={<Demo />}/>
                <Route path="/api/react/:environ/view" element={<Home />}/>
                <Route path="/api/react/:environ/info" element={<Info />}/>
                <Route path="/api/react/:environ/users" element={<Users />}/>
                <Route path="/api/react/:environ/users/:email" element={<User />}/>
            </Routes>
            </GlobalContext.Provider>
        </Router>
    </div>);
};

export default App;
