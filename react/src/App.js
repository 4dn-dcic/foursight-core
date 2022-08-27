import './App.css';
import { useState, useEffect} from 'react';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import GlobalContext from "./GlobalContext.js";
import Home from './Home.js';
import Info from './Info.js';
import User from './User.js';
import Users from './Users.js';
import Demo from './Demo.js';
import Header from './Header';
import { fetchData } from './FetchUtils.js';
import AppRoutes from './AppRoutes';


const App = () => {

    let [ info, setInfo ] = useState({loading: true});
    let [ loading, setLoading ] = useState(true);
    //const url = "http://localhost:8000/api/reactapi/cgap-supertest/info"
    const url = "https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/reactapi/cgap-supertest/info"
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
