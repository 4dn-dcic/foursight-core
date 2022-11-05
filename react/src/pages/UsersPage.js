import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { RingSpinner } from '../Spinners';
import { useFetch } from '../utils/Fetch';
import Char from '../utils/Char';
import Client from '../utils/Client';
import PaginationControl from '../PaginationControl';
import { PuffSpinner, BarSpinner } from '../Spinners';
import Server from '../utils/Server';
import Str from '../utils/Str';
import TableHead from '../TableHead';
import PagedTableComponent from '../PagedTableComponent';
import Time from '../utils/Time';
import Type from '../utils/Type';

const UsersPage = () => {

    const { environ } = useParams();
    const [ args ] = useSearchParams();
    const users = useFetch();

    function update(limit, offset, sort, onDone) {
        if (!Type.IsInteger(limit)) limit = parseInt(args.get("limit")) || 20;
        if (!Type.IsInteger(offset)) offset = parseInt(args.get("offset")) || 0;
        if (!Type.IsInteger(sort)) sort = args.get("sort") || "email.asc";
        if (!Type.IsFunction(onDone)) onDone = () => {}
        users.refresh({
            url: Server.Url(`/users/?limit=${limit}&offset=${offset}&sort=${sort}`, environ),
            onDone: (response) => onDone(response)
        });
    }

    if (users.error) return <>Cannot load users from Foursight: {users.error}</>;

    const columns = [
        { label: "" },
        { label: "User", key: "email" },
        { label: "Groups", key: "groups" },
        { label: "Project", key: "project" },
        { label: "Institution", key: "institution" },
        { label: "Updated" },
        { label: "Created" }
    ];

    const tdStyle = { verticalAlign: "top", paddingRight: "1pt", paddingTop: "4pt", paddingBottom: "8pt" };

    return <>
        <div className="container">
           <div>
                &nbsp;<b>Users</b>
                <div style={{float:"right"}}>
                    <Link to={Client.Path("/users/create")} style={{fontSize:"small",paddingRight:"0.2em"}}>New User</Link>&nbsp;|&nbsp;
                    <b className="tool-tip" data-text="Click to refresh." style={{float:"right",cursor:"pointer"}} onClick={update}>{Char.Refresh}&nbsp;</b>
                </div>
                <div style={{height:"2px",background:"darkblue",marginTop:"2pt",marginBottom:"6pt"}}></div>
            </div>
            <PagedTableComponent
                columns={columns}
                data={users}
                update={update}
                initialSort={"email.asc"}>
                    {users.map("list", (user, index) => (
                        <tr key={user.uuid} style={{verticalAlign:"top",borderBottom:"1px solid gray"}}>
                            <td style={{...tdStyle, fontSize:"small"}}>
                                {parseInt(args.get("offset")) + index + 1}.
                            </td>
                            <td style={tdStyle}>
                                <u>{user["first_name"]} {user["last_name"]}</u>
                                { (user.title && user.title !== (user.first_name + " " + user.last_name)) && <>
                                    <small>&nbsp;({user.title})</small>
                                </>}
                                <br />
                                <Link to={Client.Path("/users/" + user.email)}><b>{user.email}</b></Link> <br />
                                <small id="{user.uuid}" style={{cursor:"copy"}}>{user.uuid}</small>
                            </td>
                            <td style={tdStyle}>
                                {user.groups && user.groups?.length > 0 ? user.groups : Char.EmptySet}
                            </td>
                            <td style={tdStyle}>
                                {user?.project?.replace("/projects/","")?.replace("/","") || Char.EmptySet}
                            </td>
                            <td style={tdStyle}>
                                {user?.institution?.replace("/institutions/","")?.replace("/","") || Char.EmptySet}
                            </td>
                            <td style={tdStyle}>
                                {Time.FormatDate(user.updated)} <br />
                                <small>{Time.FormatTime(user.updated)}</small>
                            </td>
                            <td style={tdStyle}>
                                {Time.FormatDate(user.created)} <br />
                                <small>{Time.FormatTime(user.created)}</small>
                            </td>
                            <td style={tdStyle}>
                                <Link to={Client.Path(`/users/edit/${user.uuid}`)}>Edit</Link>
                            </td>
                        </tr>
                    ))}
            </PagedTableComponent>
        </div>
    </>
};

export default UsersPage;
