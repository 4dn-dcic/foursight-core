import './App.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { useState, useEffect} from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Home from './Home.js';
import User from './User.js';
import Users from './Users.js';
import Contact from './Contact.js';
import Demo from './Demo.js';

const App = () => {
  return (
    <div style={{ padding: 50 }}>
      <Router>
        <Routes>
          <Route path="/api/react/:environ" element={<Home />} />
          <Route path="/api/react/:environ/demo" element={<Demo />}/>
          <Route path="/api/react/:environ/home" element={<Home />}/>
          <Route path="/api/react/:environ/contact" element={<Contact />}/>
          <Route path="/api/react/:environ/users" element={<Users />}/>
          <Route path="/api/react/:environ/users/:email" element={<User />}/>
        </Routes>
      </Router>
    </div>
  );
};
export default App;
