import { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import { fetchData, URL } from './Utils.js';
import Loader from "./Loader.js";
import GlobalContext from "./GlobalContext.js";

const Users = (props) => {

    console.log("Users Page")
    const [ info, setInfo ] = useContext(GlobalContext);
        if (!info.loading) info.currentPage = "users";
    info.currentPage = "users"
    const url = "http://localhost:8000/api/reactapi/cgap-supertest/users"
    let [ users, setUsers ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    useEffect(() => { fetchData(url, setUsers, setLoading)}, []);
     useEffect(() => {
         console.log('USE-EFFECT!! Users')
         info.homePageStyle = "normal"
         info.infoPageStyle = "normal"
         info.usersPageStyle = "bold"
         info.currentPage  = "users"
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
                        <li key={user.email_address}><b><Link to={URL("/users/" + user.email_address)}>{user.email_address}</Link></b><br />{user.first_name} {user.last_name}</li>
                    ))}
                </ul>
            )}
        </div>
        <Loader loading={loading} />
    </>);

};

export default Users;
