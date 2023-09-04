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
    const affiliationInfo = userInfo.useAffiliationInfo();
    const navigate = useNavigate();

    function updateUserData(user) {
            /*
        if (Type.IsArray(user.consortia) && (user.consortia.length > 0)) {
            user.consortium = user.consortia[0];
        }
        if (Type.IsArray(user.submission_centers) && (user.submission_centers.length > 0)) {
            user.submission_center = user.submission_centers[0];
        }
        */
        setInputs(inputs => {
            for (const input of inputs) {
                if      (input.key === "email")       input.value = user.email;
                else if (input.key === "first_name")  input.value = user.first_name;
                else if (input.key === "last_name")   input.value = user.last_name;
                else if (input.key === "admin")       input.value = user.groups?.includes("admin") ? true : false;
                else if (input.key === "role")        input.value = (project) => affiliationInfo.userRole(user, project ||  user?.project);
                else if (input.key === "project")     input.value = user.project;
                else if (input.key === "institution") input.value = user.institution;
                else if (input.key === "award")       input.value = user.award;
                else if (input.key === "lab")         input.value = user.lab;
                else if (input.key === "consortium")  input.value = user.consortia;
                else if (input.key === "submission_center") input.value = user.submission_center;
                else if (input.key === "status")      input.value = user.status;
                else if (input.key === "created")     input.value = DateTime.Format(user.created);
                else if (input.key === "updated")     input.value = DateTime.Format(user.updated);
                else if (input.key === "uuid")        input.value = user.uuid;
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
