import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import { Link } from '../Components';
import Client from '../utils/Client';
import EditBox from './EditBox';
import Server from '../utils/Server';
import UserDefs from './UserDefs';
import useHeader from '../hooks/Header';

const UserCreatePage = () => {
    
    const user = useFetch(Server.Url("/users"), { method: "POST", nofetch: true });
    const [ inputs ] = useState(UserDefs.Inputs(useHeader()));

    const navigate = useNavigate();

    useEffect(() => {
        const institutionInput = inputs.find(input => input.name === "institution");
        if (institutionInput) {
            institutionInput.subComponent =
                (institution) =>
                    <UserDefs.PrincipalInvestigatorLine institution={institution} />
        }
    }, []);

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
            onSuccess: (response) => navigate(Client.Path(`/users/${response.data?.uuid}`))
        });
    }

    function onCancel() {
        navigate(Client.Path(`/users`));
    }

    return <center>
        <table><tbody><tr><td>
            <b style={{float:"left"}}>Create User</b>
            <div style={{float:"right",fontSize:"small",marginTop:"1pt",marginRight:"4pt"}}>
                <Link to="/users" bold={false}><span style={{color:"var(--box-fg)"}}>List</span></Link>
            </div>
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
