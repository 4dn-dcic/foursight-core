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
import { fetchData } from './Utils.js';


const AppRoutes = () => {
    return (
            <Routes>
                <Route path="/api/react/:environ" element={<Home />} />
                <Route path="/api/react/:environ/demo" element={<Demo />}/>
                <Route path="/api/react/:environ/view" element={<Home />}/>
                <Route path="/api/react/:environ/info" element={<Info />}/>
                <Route path="/api/react/:environ/users" element={<Users />}/>
                <Route path="/api/react/:environ/users/:email" element={<User />}/>
            </Routes>
    );
};

export default AppRoutes;
