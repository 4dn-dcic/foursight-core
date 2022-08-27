import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchData } from './FetchUtils.js';
import { RingSpinner } from "./Spinners.js";
import { LoginRequired } from "./LoginUtils.js";
import * as URL from './URL.js';
import * as API from "./API.js";

const Users = () => {

    const url = API.Url("/users", true);
    let [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    useEffect(() => { fetchData(url, setUsers, setLoading)}, []);

    if (loading) {
        return <LoginRequired>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={loading} color={'blue'} size={90} />
            </div>
        </LoginRequired>
    }
    return <LoginRequired>
        <h3>All Users (TODO - Paging):</h3>
        <hr />
        <div>
            {users.length > 0 && (
                <ul>
                    {users.map(user => (
                        <li key={user.email_address}><b><Link to={URL.Url("/users/" + user.email_address, true)}>{user.email_address}</Link></b><br />{user.first_name} {user.last_name}</li>
                    ))}
                </ul>
            )}
        </div>
    </LoginRequired>
};

export default Users;
