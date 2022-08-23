import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from './Utils.js';

const User = (props) => {

    const { email } = useParams()
    const url = `http://localhost:8000/api/reactapi/cgap-supertest/users/${email}`
    const [ users, setUsers ] = useState([]);
    useEffect(() => { fetchData(url, setUsers)}, []);

    return (<>
        <h1>User:</h1>
        <div>
            { users.length > 0 && (
                <ul>
                    {users.map(user => (
                        <li key={user.email_address}><b>{user.email_address}</b><br />{user.record.first_name} {user.record.last_name}</li>
                    ))}
                </ul>
            )}
        </div>
    </>);

};

export default User;
