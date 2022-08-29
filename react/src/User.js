import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from './FetchUtils.js';
import { RingSpinner } from "./Spinners.js";
import { LoginAndValidEnvRequired } from "./LoginUtils.js";
import * as API from "./API.js";
let YAML = require('json-to-pretty-yaml');

const User = (props) => {

    const { email } = useParams()
    const url = API.Url(`/users/${email}`, true);
    const [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    useEffect(() => { fetchData(url, setUsers, setLoading)}, []);

    if (loading) {
        return <LoginAndValidEnvRequired>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={loading} color={'blue'} size={90} />
            </div>
        </LoginAndValidEnvRequired>
    }
    return <LoginAndValidEnvRequired>
        <div className="container">
            {users.length > 0 && users.map(user => (
                <div key={user.record.uuid}>
                    <div style={{fontWeight:"bold",marginBottom:"6px"}}>{user.email_address}</div>
                        <pre className="info">
                            {YAML.stringify(user.record)}
                        </pre>
                </div>
            ))}
        </div>
    </LoginAndValidEnvRequired>
};

export default User;
