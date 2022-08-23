import logo from './logo.svg';
import './App.css';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';

const Home = (props) => {
  return (
    <>
      <h1>Home:</h1>
      <hr />
      <p style={{ marginTop: "150vh" }}>
        <Link to="/contact">Go to contact page</Link>
      </p>
    </>
  );
};

export default Home;
