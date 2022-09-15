import { useContext, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { fetchData } from '../utils/FetchUtils';
import { RingSpinner } from "../Spinners";
import { LoginAndValidEnvRequired } from "../utils/LoginUtils";
import * as URL from '../utils/URL';
import SERVER from "../utils/SERVER";

const UsersPage = () => {

    const url = SERVER.Url("/users", true);
    let [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    useEffect(() => { fetchData(url, setUsers, setLoading, setError)}, []);

    if (error) return <>Cannot load users from Foursight: {error}</>;
    if (loading) {
        return <LoginAndValidEnvRequired>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={loading} color={'blue'} size={90} />
            </div>
        </LoginAndValidEnvRequired>
    }
    return <LoginAndValidEnvRequired>
        <div className="container">
            <div className="info boxstyle">
                <table style={{width:"100%"}}>
                <thead>
                    <tr style={{borderBottom:"2px solid darkblue"}}>
                        <td style={{padding:"10px",fontWeight:"bold",width:"20%"}}>
                            User
                        </td>
                        <td style={{padding:"10px",fontWeight:"bold",width:"20"}}>
                            Roles
                        </td>
                        <td style={{padding:"10px",fontWeight:"bold",width:"60%"}}>
                            Modified
                        </td>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.uuid} style={{borderBottom:"1px solid gray"}}>
                            <td style={{borderBottom:"1px solid gray",padding:"10px"}}>
                                <Link to={URL.Url("/users/" + user.email_address, true)}><b>{user.email_address}</b></Link> <br />
                                {user["first_name"]} {user["last_name"]} <br />
                                <small id="{user.uuid}" style={{cursor:"copy"}}>{user.uuid}</small>
                            </td>
                            <td style={{padding:"10px",verticalAlign:"top"}}>
                                TODO
                            </td>
                            <td style={{padding:"10px",verticalAlign:"top"}}>
                                {user.modified}
                            </td>
                        </tr>
                    ))}
                </tbody>
                </table>
            </div>
        </div>
    </LoginAndValidEnvRequired>
};

export default UsersPage;
