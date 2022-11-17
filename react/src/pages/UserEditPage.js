import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from '../Components';
import { useFetch } from '../utils/Fetch';
import Client from '../utils/Client';
import EditBox from './EditBox';
import Server from '../utils/Server';
import Time from '../utils/Time';
import UserDefs from './UserDefs';
import { useReadOnlyMode } from '../ReadOnlyMode';

const UserEditPage = () => {
    
    const { uuid } = useParams();
    const [ inputs, setInputs ] = useState(UserDefs.Inputs());
    const [ notFound, setNotFound ] = useState(false);
    const [ readOnlyMode ] = useReadOnlyMode();
    const user = useFetch({
        url: Server.Url(`/users/${uuid}`),
        onData: updateUserData,
        onError: (response) => {
            if (response.status === 404) {
                setNotFound(true);
            }
        }
    });
    const navigate = useNavigate();

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
            onSuccess: () => navigate(Client.Path(`/users`))
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
                <b style={{float:"left"}}>Edit User</b>
                <div style={{float:"right",marginTop:"4pt",marginRight:"4pt",fontSize:"small"}}><Link to={"/users/create"} bold={false}>New User</Link></div>
            </div>
            { notFound ? <>
                <div className="box">
                    The specified user was not found: {uuid} <p />
                    <button className="button cancel" onClick={onCancel}>Cancel</button>
                </div>
            </>:<>
                <EditBox
                    title={"Edit User"}
                    inputs={inputs}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onCancel={onCancel}
                    onRefresh={onRefresh}
                    loading={user.loading}
                    readonly={readOnlyMode} />
            </>}
        </center>
    </>
}

export default UserEditPage;
