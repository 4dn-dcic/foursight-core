import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { RingSpinner } from '../Spinners';
import { useFetch } from '../utils/Fetch';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Server from '../utils/Server';

const UsersPage = () => {

    const [ args, setArgs ] = useSearchParams();
    const [ limit, setLimit ] = useState(parseInt(args.get("limit")) || 25);
    const [ offset, setOffset ] = useState(parseInt(args.get("offset")) || 0);
    const [ sort, setSort ] = useState(args.get("sort") || "timestamp.desc")

    const response = useFetch(Server.Url(`/users?limit=${limit}`));

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
                &nbsp;<b>Users</b>
                <div style={{float:"right"}}>
                <Link to={Client.Path("/users/create")} style={{fontSize:"small",paddingRight:"0.2em"}}>New User</Link>&nbsp;|&nbsp;
                <b className="tool-tip" data-text="Click to refresh." style={{cursor:"pointer"}} onClick={response.refresh}>{Char.Refresh}&nbsp;</b>
                </div>
            </div>
            <div className="info boxstyle" style={{marginTop:"4pt"}}>
                <table style={{width:"100%"}}>
                <thead>
                    <tr style={{borderBottom:"2px solid darkblue"}}>
                        <td style={{padding:"10px",fontWeight:"bold",width:"20%"}}>
                            User
                        </td>
                        <td style={{padding:"10px",fontWeight:"bold",width:"20"}}>
                            Groups
                        </td>
                        <td style={{padding:"10px",fontWeight:"bold",width:"60%"}}>
                            Modified
                        </td>
                        <td></td>
                    </tr>
                </thead>
                <tbody>
                    {response.map(user => (
                        <tr key={user.uuid} style={{borderBottom:"1px solid gray"}}>
                            <td style={{borderBottom:"1px solid gray",padding:"10px"}}>
                                <Link to={Client.Path("/users/" + user.email)}><b>{user.email}</b></Link> <br />
                                {user["first_name"]} {user["last_name"]} <br />
                                <small id="{user.uuid}" style={{cursor:"copy"}}>{user.uuid}</small>
                            </td>
                            <td style={{padding:"10px",verticalAlign:"top"}}>
                                {user.groups}
                            </td>
                            <td style={{padding:"10px",verticalAlign:"top"}}>
                                {user.modified}
                            </td>
                            <td style={{padding:"10px",verticalAlign:"top"}}>
                                <Link to={Client.Path(`/users/edit/${user.uuid}`)}>Edit</Link>
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
