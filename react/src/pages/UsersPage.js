import { useParams, useSearchParams } from 'react-router-dom';
import { Link } from '../Components';
import { useFetch } from '../utils/Fetch';
import Char from '../utils/Char';
import { FetchErrorBox } from '../Components';
import Server from '../utils/Server';
import Str from '../utils/Str';
import PagedTableComponent from '../PagedTableComponent';
import Styles from '../Styles';
import Time from '../utils/Time';
import Type from '../utils/Type';

const UsersPage = () => {

    const { environ } = useParams();
    const [ args ] = useSearchParams();
    const users = useFetch();

    function update(limit, offset, sort, onDone) {
        if (!Type.IsInteger(limit)) limit = parseInt(args.get("limit")) || 25;
        if (!Type.IsInteger(offset)) offset = parseInt(args.get("offset")) || 0;
        if (!Str.HasValue(sort)) sort = args.get("sort") || "email.asc";
        if (!Type.IsFunction(onDone)) onDone = () => {}
        users.refresh({
            url: Server.Url(`/users/?limit=${limit}&offset=${offset}&sort=${sort}`, environ),
            onDone: (response) => onDone(response)
        });
    }

    if (users.error) return <FetchErrorBox error={users.error} message="Error loading users from Foursight API" center={true} />

    const columns = [
        { label: "" },
        { label: "User", key: "email" },
        { label: "Groups", key: "groups" },
        { label: "Project", key: "project" },
        { label: "Institution", key: "institution" },
        { label: "Updated", key: "data_modified" }, // DOES NOT WORK (nested in last_modified)
        { label: "Created", key: "date_created" }
    ];

    const tdStyle = { verticalAlign: "top", paddingRight: "1pt", paddingTop: "4pt", paddingBottom: "8pt" };

    return <>
        <div className="container fg">
           <div>
                <b>Users</b>
                <div style={{float:"right",marginTop:"3pt",marginRight:"4pt",fontSize:"small"}}>
                    <Link to={"/users/create"} bold={false}>Create</Link>
                </div>
                <div style={{height:"1px",background:Styles.GetForegroundColor(),marginTop:"2pt",marginBottom:"4pt"}}></div>
            </div>
            <PagedTableComponent
                columns={columns}
                data={users}
                update={update}
                initialSort={"email.asc"}>
                    {users.map("list", (user, index) => (
                        <tr key={user.uuid} style={{verticalAlign:"top",borderBottom:index < users?.data?.list?.length - 1 ? "1px solid gray" : "0"}}>
                            <td style={{...tdStyle, fontSize:"small"}}>
                                {parseInt(args.get("offset")) + index + 1}.
                            </td>
                            <td style={tdStyle}>
                                <u>{user["first_name"]} {user["last_name"]}</u>
                                { (user.title && user.title !== (user.first_name + " " + user.last_name)) && <>
                                    <small>&nbsp;({user.title})</small>
                                </>}
                                <br />
                                <Link to={"/users/" + user.email}><b>{user.email}</b></Link> <br />
                                <small id="{user.uuid}" style={{cursor:"copy"}}>{user.uuid}</small>
                            </td>
                            <td style={tdStyle}>
                                {user.groups && user.groups?.length > 0 ? user.groups : Char.EmptySet}
                            </td>
                            <td style={tdStyle}>
                                <span className="tool-tip" data-text={user.project}>{user.project?.replace("/projects/","")?.replace("/","") || Char.EmptySet}</span>
                            </td>
                            <td style={tdStyle}>
                                <span className="tool-tip" data-text={user.institution}>{user.institution?.replace("/institutions/","")?.replace("/","") || Char.EmptySet}</span>
                            </td>
                            <td style={tdStyle}>
                                {user.updated ? Time.FormatDate(user.updated) : Time.FormatDate(user.created)} <br />
                                <small>{user.updated ? Time.FormatTime(user.updated) : Time.FormatTime(user.created)}</small>
                            </td>
                            <td style={tdStyle}>
                                {Time.FormatDate(user.created)} <br />
                                <small>{Time.FormatTime(user.created)}</small>
                            </td>
                            <td style={tdStyle}>
                                <Link to={`/users/edit/${user.uuid}`}>Edit</Link>
                            </td>
                        </tr>
                    ))}
            </PagedTableComponent>
        </div>
    </>
};

export default UsersPage;
