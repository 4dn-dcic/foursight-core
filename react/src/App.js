import './App.css';
import { useState, useEffect} from 'react';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import GlobalContext from "./GlobalContext.js";
import AppRoutes from './AppRoutes';
import Home from './Home.js';
import Info from './Info.js';
import User from './User.js';
import Users from './Users.js';
import Demo from './Demo.js';
import Header from './Header';
import { fetchData } from './FetchUtils.js';
import * as API from './API.js';


const App = () => {
        console.log('xxx')
        console.log(window.location)
        console.log(window.location.origin)

    let [ info, setInfo ] = useState({loading: true});
    let [ loading, setLoading ] = useState(true);
        console.log('fetchinfo................')
    const url = API.Url("/info", true);
        console.log('fetchinfo2................')
        console.log(url)
    useEffect(() => { fetchData(url, setInfo , setLoading)}, []);


    return (<Router>
        <GlobalContext.Provider value={[info, setInfo]}>
            <Header />
            <div style={{margin:"20px"}}>
                <AppRoutes />
            </div>
        </GlobalContext.Provider>
    </Router>);
};

export default App;
