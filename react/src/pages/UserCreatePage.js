import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import Client from '../utils/Client';
import EditBox from './EditBox';
import Json from '../utils/Json';
import Server from '../utils/Server';
import Time from '../utils/Time';
import UserDefs from './UserDefs';

const UserCreatePage = () => {
    
    const user = useFetch(Server.Url("/users"), { method: "POST", nofetch: true });
    const navigate = useNavigate();
    const [ inputs, setInputs ] = useState(UserDefs.Inputs());

    function onCreate(values) {
        console.log('*** oncreate')
        if (values.admin) {
            delete values["admin"]
            values = {...values, "groups": [ "admin" ] }
        }
        else {
            delete values["admin"]
            values = {...values, "groups": [] }
        }
        user.refresh({
            url: Server.Url(`/users`),
            method: "POST",
            payload: values,
            onSuccess: (response) => {
                navigate(Client.Path(`/users/edit/${response.data?.uuid}`));
            }
        });
    }

    function onCancel() {
        navigate(Client.Path(`/users`));
    }

    return <>
        <center>
            <div style={{display:"table-row"}}>
                <b style={{paddingLeft:"0.2em",float:"left"}}>Create User</b>
            </div>
            <EditBox
                title={"Edit User"}
                inputs={inputs}
                onCreate={onCreate}
                onCancel={onCancel} />
        </center>
    </>
}

export default UserCreatePage;
