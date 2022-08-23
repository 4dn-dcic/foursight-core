import logo from './logo.svg';
import './App.css';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';

const User = (props) => {
  return (
    <>
      <h1>User:</h1>
      <hr />
      <p style={{ marginTop: "150vh" }}>
        <Link to="/contact">Go to contact page</Link>
      </p>
    </>
  );
};

export default User;
