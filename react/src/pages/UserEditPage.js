import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import Client from '../utils/Client';
import EditBox from './EditBox';
import Json from '../utils/Json';
import Server from '../utils/Server';
import Time from '../utils/Time';

const UserEditPage = () => {
    
    const { uuid } = useParams();
    const user = useFetch(Server.Url(`/users/${uuid}`))
    const navigate = useNavigate();

    const inputs = [
        {
            name: "email",
            label: "Email Address",
            value: () => user.get("email"),
            focus: true
        },
        {
            name: "first_name",
            label: "First Name",
            value: () => user.get("first_name")
        },
        {
            name: "last_name",
            label: "Last Name",
            value: () => user.get("last_name")
        },
        {
            name: "created",
            label: "Created",
            value: () => Time.FormatDateTime(user.get("date_created")),
            readonly: true
        },
        {
            name: "modified",
            label: "Modified",
            value: () => Time.FormatDateTime(user.get("last_modified.date_modified")),
            readonly: true
        },
        {
            name: "uuid",
            label: "UUID",
            value: () => user.get("uuid"),
            readonly: true
        },
    ];

    function onSave(values) {
        user.refresh({
                onData: (data) => { console.log('xxxxxxxxxxxxxxxxxxxxxx'); console.log(data); },
            url: Server.Url(`/users/${uuid}`),
            method: "PATCH",
            payload: values
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
                <EditBox title={"Edit User"} inputs={inputs} onSave={onSave} onCancel={onCancel} onRefresh={onRefresh} loading={user.loading} />
            </center>
    </>
}

export default UserEditPage;
