import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from './FetchUtils';
import { RingSpinner } from "./Spinners";
import { LoginAndValidEnvRequired } from "./LoginUtils";
import * as API from "./API";
let YAML = require('json-to-pretty-yaml');

const User = (props) => {

    const { email } = useParams()
    const url = API.Url(`/users/${email}`, true);
    const [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    useEffect(() => { fetchData(url, setUsers, setLoading, setError)}, []);

    if (error) return <>Cannot load user ({email}) from Foursight: {error}</>;
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
