import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from '../Components';
import useFetch from '../hooks/Fetch';
import Client from '../utils/Client';
import DateTime from '../utils/DateTime';
import EditBox from './EditBox';
import Time from '../utils/Time';
import Type from '../utils/Type';
import UserDefs from './UserDefs';
import useReadOnlyMode from '../hooks/ReadOnlyMode';

const UserEditPage = () => {
    
    const { uuid } = useParams();
    const [ inputs, setInputs ] = useState(UserDefs.useUserInputs("edit"));
    const [ notFound, setNotFound ] = useState(false);
    const [ readOnlyMode ] = useReadOnlyMode();
    const user = useFetch({
        url: `/users/${uuid}`,
        onData: updateUserData,
        onError: (response) => {
            if (response.status === 404) {
                setNotFound(true);
            }
        }
    });

    const userInfo = UserDefs.useUserInfo();
    const navigate = useNavigate();

    function updateUserData(user) {
        setInputs(inputs => userInfo.normalizeUserForEdit(user, inputs));
    }

    function onUpdate(values) {
        values = userInfo.normalizeUserForUpdate(user, values);
        user.refresh({
            url: `/users/${uuid}`,
            method: "PATCH",
            payload: values
        });
    }

    function onDelete() {
        user.refresh({
            url: `/users/${uuid}`,
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

    return <center>
                {JSON.stringify(user)}
        <table><tbody><tr><td>
            <b>Edit User</b>{!user.loading && user.data ? ": " + user.data.first_name + " " + user.data.last_name : ""}
            <div style={{float:"right",marginTop:"1pt",marginRight:"4pt",fontSize:"small"}}>
                <Link to={`/users/${uuid}`} bold={false}>View</Link><>&nbsp;|&nbsp;</>
                <Link to={"/users"} bold={false}>List</Link><>&nbsp;|&nbsp;</>
                <Link to={"/users/create"} bold={false}>Create</Link>
            </div>
        </td></tr><tr><td>
            { notFound ? <>
                <div className="box">
                    The specified user was not found: {uuid} <p />
                    <button className="button cancel" onClick={onCancel}>Cancel</button>
                </div>
            </>:<>
                <EditBox
                    title={"Edit User"}
                    inputs={inputs}
                    setInputs={setInputs}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                    onCancel={onCancel}
                    onRefresh={onRefresh}
                    loading={user.loading}
                    readonly={readOnlyMode} />
            </>}
        </td></tr></tbody></table>
    </center>
}

export default UserEditPage;
