import logo from './logo.svg';
import './App.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import Home from './Home.js';
import Users from './Users.js';
import User from './User.js';
import Contact from './Contact.js';

const Demo = () => {
        //const [searchParams, setSearchParams] = useSearchParams();
        //var x = fetch("http://localhost:8000/users/cgap-supertest/david_michaels@hms.harvard.edu").then(response => response.text()).then(text => console.log(text))
        //console.log(x)
  console.log('xyzzy:useSearchParams');
  console.log(useSearchParams);
  console.log(typeof(useSearchParams));
  console.log(React.useSearchParams)
  console.log(ReactDOM.useSearchParams)
  console.log(useLocation)
  console.log('xyzzy:useLocation(): BEFORE');
    console.log(useLocation())
  console.log('xyzzy:useLocation(): AFTER');
  //try {
    console.log(useSearchParams())
  //} catch (error) {
    //console.log('xyzzy:ERROR on useSearchParams()')
  //}
  //const [count, setCount] = useState(0);
        //console.log(count)
        //console.log(setCount)
  console.log('useNavigate')
  console.log(useNavigate)
  //console.log(useNavigate())
  console.log('xyzzy:useLocation(): after');
  //useSearchParams();
  //const [searchParams] = useSearchParams();
  console.log('xyzzy:OK');
  const [search] = useSearchParams();
  console.log(search.get('sort'));
  console.log('xyzzy:OKOKOKOKOK');
  let { environ } = useParams();
        console.log('xyzzy:ENVIRON:')
        console.log(environ)
  //console.log(useSearchParams('title'));
  //const [search, setSearch] = useSearchParams();
  //console.log(search)
  //console.log(setSearch)
  //console.log(search.get('title'))
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          xdit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default Demo;
