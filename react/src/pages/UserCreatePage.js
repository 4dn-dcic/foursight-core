import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import Client from '../utils/Client';
import EditBox from './EditBox';
import Server from '../utils/Server';
import UserDefs from './UserDefs';

const UserCreatePage = () => {
    
    const user = useFetch(Server.Url("/users"), { method: "POST", nofetch: true });
    const [ inputs ] = useState(UserDefs.Inputs());
    const navigate = useNavigate();

    function onCreate(values) {
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
            onSuccess: (response) => navigate(Client.Path(`/users/edit/${response.data?.uuid}`))
        });
    }

    function onCancel() {
        navigate(Client.Path(`/users`));
    }

    return <center>
        <table><tbody><tr><td>
            <b style={{float:"left"}}>Create User</b>
        </td></tr><tr><td>
            <EditBox
                title={"Edit User"}
                inputs={inputs}
                onCreate={onCreate}
                onCancel={onCancel} />
        </td></tr></tbody></table>
    </center>
}

export default UserCreatePage;
