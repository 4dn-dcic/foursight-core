import './App.css';
import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation, useParams } from 'react-router-dom';
import { fetchData } from './Utils.js';

const Users = (props) => {

    const url = "http://localhost:8000/api/reactapi/cgap-supertest/users"
    const [ users, setUsers ] = useState([]);
    useEffect(() => { fetchData(url, setUsers)}, []);

    return (<>
        <h1>All Users:</h1>
        <div>
            {users.length > 0 && (
                <ul>
                    {users.map(user => (
                        <li key={user.email_address}><b>{user.email_address}</b><br />{user.first_name} {user.last_name}</li>
                    ))}
                </ul>
            )}
        </div>
    </>);

};

export default Users;
