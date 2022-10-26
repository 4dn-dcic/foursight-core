import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import Client from '../utils/Client';
import EditBox from './EditBox';
import Server from '../utils/Server';
import Time from '../utils/Time';
import UserDefs from './UserDefs';

const UserEditPage = () => {
    
    const { uuid } = useParams();
    const user = useFetch(Server.Url(`/users/${uuid}`), { onData: updateUserData });
    const navigate = useNavigate();
    const [ inputs, setInputs ] = useState(UserDefs.Inputs());

    function updateUserData(data) {
        setInputs(inputs => {
            for (const input of inputs) {
                if      (input.name === "email")      input.value = data?.email;
                else if (input.name === "first_name") input.value = data?.first_name;
                else if (input.name === "last_name")  input.value = data?.last_name;
                else if (input.name === "admin")      input.value = data?.groups?.includes("admin") ? true : false;
                else if (input.name === "created")    input.value = Time.FormatDateTime(data?.date_created);
                else if (input.name === "modified")   input.value = Time.FormatDateTime(data?.last_modified?.date_modified);
                else if (input.name === "uuid")       input.value = data?.uuid;
            }
            return [...inputs];
        });
    }

    function onUpdate(values) {
        let existingGroupsWithoutAnyAdmin = user.get("groups")?.filter(group => group !== "admin") || [];
        if (values.admin) {
            delete values["admin"]
            values = {...values, "groups": [ ...existingGroupsWithoutAnyAdmin, "admin" ] }
        }
        else {
            delete values["admin"]
            values = {...values, "groups": existingGroupsWithoutAnyAdmin }
        }
        user.refresh({
            url: Server.Url(`/users/${uuid}`),
            method: "PATCH",
            payload: values
        });
    }

    function onDelete() {
        user.refresh({
            url: Server.Url(`/users/${uuid}`),
            method: "DELETE",
            onSuccess: (response) => {
                navigate(Client.Path(`/users`));
            }
        });
    }

    function onCancel() {
        navigate(Client.Path(`/users/${uuid}`));
    }

    function onRefresh() {
        user.refresh();
    }

    return <>
        <center>
            <div style={{display:"table-row"}}>
                <b style={{paddingLeft:"0.2em",float:"left"}}>Edit User</b>
                <Link to={Client.Path("/users/create")} style={{fontSize:"small",paddingRight:"0.2em",float:"right"}}>New User</Link>
            </div>
            <EditBox
                title={"Edit User"}
                inputs={inputs}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onCancel={onCancel}
                onRefresh={onRefresh}
                loading={user.loading} />
        </center>
    </>
}

export default UserEditPage;
