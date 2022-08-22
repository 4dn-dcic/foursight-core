import logo from './logo.svg';
import './App.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {useState, useEffect} from 'react';
import { useNavigate } from "react-router-dom";
import {Link, useSearchParams, useLocation, useParams} from 'react-router-dom';

import {
  BrowserRouter as Router,
  Route,
  Routes,
} from "react-router-dom";

const useScrollToTop = () => {
  console.log('abc-2')
  const location = useLocation();
  const [search] = useSearchParams();
  console.log('abc-3')
  console.log(location);
  console.log('abc-4')
  console.log(search);
  console.log('abc-5')
  console.log(search.get('sort'));
  useEffect(() => {
    window.scrollTo({ top: 0 });
    // scroll to the top of the browser window when changing route
    // the window object is a normal DOM object and is safe to use in React.
  }, [location]);
};

// This is corresponding to "/" route
const Home = (props) => {
  useScrollToTop();
  return (
    <>
      <h1>Home</h1>
      <hr />
      <p style={{ marginTop: "150vh" }}>
        <Link to="/contact">Go to contact page</Link>
      </p>
    </>
  );
};

// This is corresponding to "/contact" route
const Contact = (props) => {
  useScrollToTop();
  return (
    <>
      <h1>Contact</h1>
      <hr />
      <p style={{ marginTop: "150vh" }}>
        <Link to="/">Go to homepage</Link>
      </p>
    </>
  );
};

const Users = (props) => {
  useScrollToTop();
  console.log("XYZZY:USERS!")
  var users = fetch("http://localhost:8000/api/users/cgap-supertest/david_michaels@hms.harvard.edu").then(response => response.text()).then(text => console.log(text));
  return (
    <>
      <h1>Users</h1>
      <hr />
      <p style={{ marginTop: "150vh" }}>
        <Link to="/">Go to homepage</Link>
      </p>
    </>
  );
};

// function App() {
const XApp = () => {
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
          Edit <code>src/App.js</code> and save to reload.
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

const App = () => {
  return (
    <div style={{ padding: 50 }}>
      <Router>
        <Routes>
          <Route path="/api/react/:environ" element={<XApp />} />
          <Route path="/api/react/:environ/contact" element={<Contact />}/>
          <Route path="/api/react/:environ/users" element={<Users />}/>
          <Route path="/api/react/:environ/users/:email" element={<Users />}/>
        </Routes>
      </Router>
    </div>
  );
};
export default App;
