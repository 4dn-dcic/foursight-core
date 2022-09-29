import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { RingSpinner } from "../Spinners";
import Fetch from "../utils/Fetch";
import SERVER from "../utils/SERVER";
import Client from "../utils/Client";

const UsersPage = () => {

    const url = SERVER.Url("/users", true);
    let [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    useEffect(() => { Fetch.get(url, setUsers, setLoading, setError)}, []);

    if (error) return <>Cannot load users from Foursight: {error}</>;
    if (loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={loading} color={'blue'} size={90} />
            </div>
        </>
    }
    return <>
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
                                <Link to={Client.Path("/users/" + user.email_address)}><b>{user.email_address}</b></Link> <br />
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
    </>
};

export default UsersPage;
