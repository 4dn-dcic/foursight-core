import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from './FetchUtils.js';
import GlobalContext from "./GlobalContext.js";
import { VerifyLogin } from "./LoginUtils.js";
import * as API from "./API.js";

const User = (props) => {

    let loggedIn = VerifyLogin()

    console.log("User Page")
    const [ info, setInfo ] = useContext(GlobalContext);
    const { email } = useParams()
    //const url = `http://localhost:8000/api/reactapi/cgap-supertest/users/${email}`
    //const url = `https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/reactapi/cgap-supertest/users/${email}`
    const url = API.Url(`/users/${email}`, true);
    const [ users, setUsers ] = useState([]);
    useEffect(() => { fetchData(url, setUsers)}, []);

    useEffect(() => {
         console.log('USE-EFFECT!! User')
         if (!info.loading) {
            setInfo(JSON.parse(JSON.stringify(info)))
         }
    }, []);

    if (!loggedIn) return <></>; if (info.loading) return <>Loading ...</>; return <>
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
    </>;
};

export default User;
