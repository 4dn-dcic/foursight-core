import './App.css';
import { useState, useEffect} from 'react';
import { BrowserRouter as Router } from "react-router-dom";
import GlobalContext from "./GlobalContext.js";
import AppRoutes from './AppRoutes';
import Header from './Header';
import { fetchData } from './FetchUtils.js';
import * as API from './API.js';

const App = () => {

    let [ info, setInfo ] = useState({loading: true});
    let [ loading, setLoading ] = useState(true);
    const url = API.Url("/info", true);
    useEffect(() => { fetchData(url, setInfo , setLoading)}, []);

    return <Router>
        <GlobalContext.Provider value={[info, setInfo]}>
            <Header />
            <div style={{margin:"20px"}}>
                <AppRoutes />
            </div>
        </GlobalContext.Provider>
    </Router>;
};

export default App;
