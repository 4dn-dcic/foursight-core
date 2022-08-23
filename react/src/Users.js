import logo from './logo.svg';
import './App.css';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';

const Users = (props) => {
  const users = fetch("http://localhost:8000/api/users/cgap-supertest/david_michaels@hms.harvard.edu").then(response => response.text()).then(text => console.log(text))
  console.log("USERS!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
  console.log(users);
  return (
    <>
      <h1>Users:</h1>
      <hr />
      <p style={{ marginTop: "150vh" }}>
        <Link to="/contact">Go to contact page</Link>
      </p>
    </>
  );
};

export default Users;
