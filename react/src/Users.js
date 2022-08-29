import { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { fetchData } from './FetchUtils.js';
import { RingSpinner } from "./Spinners.js";
import { LoginAndValidEnvRequired } from "./LoginUtils.js";
import * as URL from './URL.js';
import * as API from "./API.js";

const Users = () => {

    const url = API.Url("/users", true);
    const [ info ] = useContext(GlobalContext);
    let [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    useEffect(() => { fetchData(url, setUsers, setLoading)}, []);

    if (info.error) return <>Cannot load Foursight.</>;
    if (loading) {
        return <LoginAndValidEnvRequired>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={loading} color={'blue'} size={90} />
            </div>
        </LoginAndValidEnvRequired>
    }
    return <LoginAndValidEnvRequired>
        <div className="container" style={{fontFamily:"tahoma"}}>
            <b>Users</b>
            <ul className="top-level-list">
                <div className="info boxstyle">
                    {users.length > 0 && (<div>
                            {users.map(user => (
                                <span>
                                <li key={user.email_address}><b><Link to={URL.Url("/users/" + user.email_address, true)}>{user.email_address}</Link></b><br />{user.first_name} {user.last_name}</li>
                                    <br />
                                </span>
                            ))}
                    </div>)}
                </div>
            </ul>
        </div>
    </LoginAndValidEnvRequired>
};

export default Users;
