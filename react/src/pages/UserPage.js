import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { RingSpinner } from "../Spinners";
import SERVER from "../utils/SERVER";
import Fetch from "../utils/Fetch";
import YAML from '../utils/YAML';

const UserPage = (props) => {

    const { email } = useParams()
    const url = SERVER.Url(`/users/${email}`, true);
    const [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    useEffect(() => { Fetch.get(url, setUsers, setLoading, setError)}, []);

    if (error) return <>Cannot load user ({email}) from Foursight: {error}</>;
    if (loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={loading} color={'blue'} size={90} />
            </div>
        </>
    }
    return <>
        <div className="container">
            {users.length > 0 && users.map(user => (
                <div key={user.record.uuid}>
                    <div style={{fontWeight:"bold",marginBottom:"6px"}}>{user.email_address}</div>
                        <pre className="info">
                            {YAML.Format(user.record)}
                        </pre>
                </div>
            ))}
        </div>
    </>
};

export default UserPage;
