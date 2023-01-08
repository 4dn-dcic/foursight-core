import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Link } from '../Components';
import { useFetch } from '../utils/Fetch';
import Client from '../utils/Client';
import EditBox from './EditBox';
import Time from '../utils/Time';
import UserDefs from './UserDefs';
import { useReadOnlyMode } from '../ReadOnlyMode';

const UserEditPage = () => {
    
    const { uuid } = useParams();
    const [ inputs, setInputs ] = useState(UserDefs.Inputs());
    const [ notFound, setNotFound ] = useState(false);
    const [ readOnlyMode ] = useReadOnlyMode();
    const [ project, setProject ] = useState('foo');
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

    const navigate = useNavigate();

    useEffect(() => {
        user.fetch();
    }, [uuid]);

    function getUserRoleAssociatedWithProject(/*user,*/ project) {
        if (user.loading || !user.data) return "";
        for (const projectRole of user.data.roles) {
            if (projectRole.project === project) {
                return projectRole.role;
            }
        }
        //
        // if (project === "/projects/cgap-backend-testing/") return "director" // xyzzy/testing
        // If the given project (currently selected on edit page) does not have
        // an associated role, then return the role for the associaed with the
        // actual current user project.
        //
        for (const projectRole of user.data.roles) {
            if (projectRole.project === user.data.project) {
                return projectRole.role;
            }
        }
        return null;
    }

    function updateUserData(data) {
        setInputs(inputs => {
            for (const input of inputs) {
                if      (input.name === "email")       input.value = data?.email;
                else if (input.name === "first_name")  input.value = data?.first_name;
                else if (input.name === "last_name")   input.value = data?.last_name;
                else if (input.name === "admin")       input.value = data?.groups?.includes("admin") ? true : false;
                else if (input.name === "project")     input.value = data?.project;
                else if (input.name === "role")        input.value = (project) => getUserRoleAssociatedWithProject(/*data,*/ project || data?.project);
                else if (input.name === "institution") input.value = data?.institution;
                else if (input.name === "created")     input.value = Time.FormatDateTime(data?.created);
                else if (input.name === "updated")     input.value = Time.FormatDateTime(data?.updated);
                else if (input.name === "uuid")        input.value = data?.uuid;
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
            <b>Edit User</b>
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
