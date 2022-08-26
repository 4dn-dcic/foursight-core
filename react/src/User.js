import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from './FetchUtils.js';
import GlobalContext from "./GlobalContext.js";

const User = (props) => {

    console.log("User Page")
    const [ info, setInfo ] = useContext(GlobalContext);
    const { email } = useParams()
    const url = `http://localhost:8000/api/reactapi/cgap-supertest/users/${email}`
    const [ users, setUsers ] = useState([]);
    useEffect(() => { fetchData(url, setUsers)}, []);

    useEffect(() => {
         console.log('USE-EFFECT!! User')
         if (!info.loading) {
            setInfo(JSON.parse(JSON.stringify(info)))
         }
    }, []);

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
