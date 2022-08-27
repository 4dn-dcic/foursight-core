import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { fetchData } from './FetchUtils.js';
import { RingSpinner } from "./Spinners.js";
import GlobalContext from "./GlobalContext.js";
import { VerifyLogin } from "./LoginUtils.js";
import * as URL from './URL.js';
import * as API from "./API.js";

const Users = (props) => {

    //VerifyLogin();

    const [ info, setInfo ] = useContext(GlobalContext);
    //const url = "http://localhost:8000/api/reactapi/cgap-supertest/users"
    //const url = "https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/reactapi/cgap-supertest/users"
    const url = API.Url("/users", true);
        console.log('url....');
        console.log(url);
    let [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    useEffect(() => { fetchData(url, setUsers, setLoading)}, []);

    // For some reason we need this to cause the font weight changes (bold/normal)
    // for the header links (HOME, USERS, INFO) to take. And we do need to actually
    // reaload the info object (stringify/parse)
    // TODO: Figure this out more fullly.
    useEffect(() => {
         console.log('USE-EFFECT!! User')
         if (!info.loading) {
            setInfo(JSON.parse(JSON.stringify(info)))
         }
    }, []);

    return (<>
        <h1>All Users:</h1>
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
        <RingSpinner loading={loading} color={'blue'} size={400} />
    </>);

};

export default Users;
