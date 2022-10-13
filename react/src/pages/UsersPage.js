import { Link } from 'react-router-dom';
import { RingSpinner } from '../Spinners';
import { useFetch } from '../utils/Fetch';
import Server from '../utils/Server';
import Client from '../utils/Client';

const UsersPage = () => {

    const response = useFetch(Server.Url("/users"));

    if (response.error) return <>Cannot load users from Foursight: {response.error}</>;
    if (response.loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={response.loading} color={'blue'} size={90} />
            </div>
        </>
    }
    return <>
        <div className="container">
            <div>
                <b>Users</b>
                <b className="tool-tip" data-text="Click to refresh." style={{float:"right",cursor:"pointer"}} onClick={response.refresh}>&#8635;&nbsp;</b>
            </div>
            <div className="info boxstyle" style={{marginTop:"4pt"}}>
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
                    {response.data?.map(user => (
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
