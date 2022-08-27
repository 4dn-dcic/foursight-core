import './App.css';
import { Route, Routes } from "react-router-dom";
import Home from './Home.js';
import Info from './Info.js';
import User from './User.js';
import Users from './Users.js';
import Demo from './Demo.js';
import Header from './Header';
import Login from './Login';
import Test from './Test';

const AppRoutes = () => {
    return <Routes>
        <Route path="/api/react/:environ/login" element={<Login />} />
        <Route path="/api/react/:environ" element={<Home />} />
        <Route path="/api/react/:environ/demo" element={<Demo />}/>
        <Route path="/api/react/:environ/view" element={<Home />}/>
        <Route path="/api/react/:environ/info" element={<Info />}/>
        <Route path="/api/react/:environ/users" element={<Users />}/>
        <Route path="/api/react/:environ/users/:email" element={<User />}/>
        <Route path="/api/react/:environ/test" element={<Test />}/>
    </Routes>
};

export default AppRoutes;
