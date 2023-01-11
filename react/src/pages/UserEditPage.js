import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from '../Components';
import { useFetch } from '../utils/Fetch';
import Client from '../utils/Client';
import EditBox from './EditBox';
import Time from '../utils/Time';
import UserDefs from './UserDefs';
import { useReadOnlyMode } from '../ReadOnlyMode';
import useUserMetadata from '../hooks/UserMetadata';

const UserEditPage = () => {
    
    const { uuid } = useParams();
    const [ inputs, setInputs ] = UserDefs.useUserInputs();
    const [ notFound, setNotFound ] = useState(false);
    const [ readOnlyMode ] = useReadOnlyMode();
    const user = useFetch({
        url: `/users/${uuid}`,
        nofetch: true,
        onData: updateUserData,
        onError: (response) => {
            if (response.status === 404) {
                setNotFound(true);
            }
        }
    });

    const userMetadata = useUserMetadata();

    const navigate = useNavigate();

    useEffect(() => {
        user.fetch();
        const institutionInput = inputs.find(input => input.name === "institution");
        if (institutionInput) {
            institutionInput.subComponent =
                (institution) =>
                    <UserDefs.PrincipalInvestigatorLine institution={institution} />
        }
    }, [uuid]);

    function updateUserData(user) {
        setInputs(inputs => {
            for (const input of inputs) {
                if      (input.name === "email")       input.value = user.email;
                else if (input.name === "first_name")  input.value = user.first_name;
                else if (input.name === "last_name")   input.value = user.last_name;
                else if (input.name === "admin")       input.value = user.groups?.includes("admin") ? true : false;
                else if (input.name === "project")     input.value = user.project;
                else if (input.name === "role")        input.value = (project) => { if ((project === undefined) || (project === null)) return "-"
                                                                                    return userMetadata.userRole(user, project || user?.project) || "-"; }
                else if (input.name === "institution") input.value = user.institution;
                else if (input.name === "status")      input.value = user.status;
                else if (input.name === "created")     input.value = Time.FormatDateTime(user.created);
                else if (input.name === "updated")     input.value = Time.FormatDateTime(user.updated);
                else if (input.name === "uuid")        input.value = user.uuid;
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
        values = { ...values, "roles": user.get("roles") };
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
