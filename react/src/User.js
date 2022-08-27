import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from './FetchUtils.js';
import { RingSpinner } from "./Spinners.js";
import { LoginRequired } from "./LoginUtils.js";
import * as API from "./API.js";

const User = (props) => {

    const { email } = useParams()
    const url = API.Url(`/users/${email}`, true);
    const [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    useEffect(() => { fetchData(url, setUsers, setLoading)}, []);

    if (loading) {
        return <div style={{marginTop:"10px"}}>
            <RingSpinner loading={loading} color={'blue'} size={80} />
        </div>
    }
    return <LoginRequired>
        <h3>User:</h3>
        <div>
            { users.length > 0 && (
                <ul>
                    {users.map(user => (
                        <li key={user.email_address}><b>{user.email_address}</b><br />{user.record.first_name} {user.record.last_name}</li>
                    ))}
                </ul>
            )}
        </div>
    </LoginRequired>
};

export default User;
