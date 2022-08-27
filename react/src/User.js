import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from './FetchUtils.js';
import GlobalContext from "./GlobalContext.js";
import { VerifyLogin, LoginRequired } from "./LoginUtils.js";
import * as API from "./API.js";

const User = (props) => {

    const [ info, setInfo ] = useContext(GlobalContext);
    const { email } = useParams()
    const url = API.Url(`/users/${email}`, true);
    const [ users, setUsers ] = useState([]);
    useEffect(() => { fetchData(url, setUsers)}, []);

    useEffect(() => {
         if (!info.loading) {
            setInfo(JSON.parse(JSON.stringify(info)))
         }
    }, []);

    if (info?.loading) return <>Loading ...</>; return <LoginRequired>
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
