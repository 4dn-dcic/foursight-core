import { useParams, useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Link } from '../Components';
import useFetch from '../hooks/Fetch';
import Char from '../utils/Char';
import Date from '../utils/Date';
import Env from '../utils/Env';
import { FetchErrorBox } from '../Components';
import Server from '../utils/Server';
import Str from '../utils/Str';
import PagedTableComponent from '../PagedTableComponent';
import Styles from '../Styles';
import Tooltip from '../components/Tooltip';
import Time from '../utils/Time';
import Type from '../utils/Type';
import UserDefs from './UserDefs';
import useHeader from '../hooks/Header';

const UsersPage = () => {

    const header = useHeader();
    const { environ } = useParams();
    const [ args, setArgs ] = useSearchParams();
    const users = useFetch();
    const inputs = UserDefs.useUserInputs("list");

    const [ search, setSearch ] = useState(args.get("search") || "");
    const [ showSearch, setShowSearch ] = useState(Str.HasValue(search));

    const userInfo = UserDefs.useUserInfo();

    function update({ limit, offset, sort, search, onDone }) {
        if (!Type.IsInteger(limit)) limit = parseInt(args.get("limit")) || 25;
        if (!Type.IsInteger(offset)) offset = parseInt(args.get("offset")) || 0;
        if (!Str.HasValue(sort)) sort = args.get("sort") || "email.asc";
        if (!Str.HasValue(search)) search = args.get("search") || "";
        if (!Type.IsFunction(onDone)) onDone = () => {}
        users.refresh({
            url: Server.Url(`/users/?limit=${limit}&offset=${offset}&sort=${sort}${search ? `&search=${search}` : ""}`, environ),
            onData: (data) => {
                userInfo.normalizeUsers(data.list);
                return data;
            },
            onDone: (response) => onDone(response)
        });
    }

    if (users.error) return <FetchErrorBox error={users.error} message="Error loading users from Foursight API" center={true} />

/*
    let xcolumns = [
        { label: "" },
        { label: "User", key: "email" },
        { label: "Groups", key: "groups" },
        ...userInfo.affiliations(),
        { label: "Status", key: "status" },
        { label: "Updated", key: "data_modified" }, // DOES NOT WORK (nested in last_modified)
        { label: "Created", key: "date_created" }
    ];
*/
        let columns = [ { label: "" }, ...inputs ];

    const tdStyle = { verticalAlign: "top", paddingRight: "6pt", paddingTop: "4pt", paddingBottom: "8pt" };
    const tdStyleNowrap = { ...tdStyle, whiteSpace: "nowrap" };

    function toggleSearch() {
        if (showSearch) {
            if (Str.HasValue(search)) {
                updateArgs("search", null);
                update();
            }
            setSearch("");
            setShowSearch(false);
        }
        else {
            setShowSearch(true);
        }
    }

    function updateArgs(...items) {
        for (let i = 0 ; i < items.length ; i += 2) {
            const name = items[i];
            if (Str.HasValue(name)) {
                const value = i + 1 < items.length ? items[i + 1] : undefined;
                if (Type.IsNull(value) || (Type.IsString(value) && !Str.HasValue(value))) {
                    args.delete(name);
                }
                else {
                    args.set(name, value);
                }
            }
        }
        setArgs(args);
    }

    function doSearch(e) {
        updateArgs("search", search);
        update({ offste: 0, search: search });
        e.stopPropagation(); e.preventDefault();
    }

    function onSearchInput(e) {
        const search = e.currentTarget.value;
        setSearch(search);
    }

    const inputStyle = {
        outline: "none",
        paddingLeft: "2pt",
        display: "inline",
     // border: "1px solid gray",
        borderBottom: "0",
        borderTop: "0",
        borderRight: "0",
        borderLeft: "0",
        bottom: "1pt",
        fontSize: "small",
        fontWeight: "bold",
        color: "var(--box-fg)",
        width: "100%"
    };
    //let xyz = userInfo.AffiliationTableRows('asdfa','sadfa');

    return <>
        <div className="container fg">
           <div>
                <table width="100%" border="0"><tbody><tr>
                    <td style={{width:"2%"}}>
                        <div style={{marginBottom:"2pt"}}><b>Users</b></div>
                    </td>
                    <td style={{whiteSpace:"nowrap"}}>
                        <span className="pointer" onClick={toggleSearch}>&nbsp;&nbsp;{Char.Search}</span>&nbsp;&nbsp;
                        { (showSearch || Str.HasValue(search)) && <>
                            <form onSubmit={doSearch}>
                                <input placeholder="Experimental search for users ..." type="text" autoFocus style={inputStyle} value={search} onChange={onSearchInput} />
                            </form>
                        </>}
                    </td>
                    <td style={{fontSize:"small"}}>
                        <div style={{float:"right"}}><Link to={"/users/create"} bold={false}>Create</Link></div>
                    </td>
                </tr></tbody></table>
                <div style={{float:"right",marginTop:"3pt",marginRight:"4pt",fontSize:"small"}}>
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
                            { columns.map(column => <>
                                <td style={{...tdStyle, whiteSpace:column.type == "datetime" ? "nowrap" : ""}}>
                                    { column.uiList ? <>
                                        {column.uiList(user)}
                                    </>:<>
                                        { column.key ? <>
                                            { column.type === "datetime" ? <>
                                                {Date.Format(user[column.key])} <br />
                                                <small>{Time.Format(user[column.key])}</small>
                                            </>:<>
                                                { column.map ? <>
                                                    { column.mapWithUser ? <>
                                                        {column.map(user)}
                                                    </>:<>
                                                        {column.map(user[column.key], userInfo)}
                                                    </> }
                                                </>:<>
                                                    {user[column.key]}
                                                </> }
                                            </> }
                                        </>:<>
                                            {parseInt(args.get("offset")) + index + 1}.
                                        </> }
                                    </> }
                                </td>
                            </>)}
                            <td style={tdStyle}>
                                {user.group_titles}
                            </td>
                            <userInfo.AffiliationTableRows user={user} tdStyle={tdStyle} />
                            <td style={tdStyle}>
                                <span id={`tooltip-users-status-${user.status}`}>{user.status_title || Char.EmptySet}</span>
                                <Tooltip id={`tooltip-users-status-${user.status}`} position="bottom" size="small" text={`Status: ${user.status}`} />
                            </td>
                            <td style={{...tdStyle,whiteSpace:"nowrap"}}>
                                {user.updated ? Date.Format(user.updated) : Date.Format(user.created)} <br />
                                <small>{user.updated ? Time.Format(user.updated) : Time.Format(user.created)}</small>
                            </td>
                            <td style={{...tdStyle,whiteSpace:"nowrap"}}>
                                {Date.Format(user.created)} <br />
                                <small>{Time.Format(user.created)}</small>
                            </td>
                            <td style={{...tdStyle,whiteSpace:"nowrap"}}>
                                &nbsp;&nbsp;<button><Link to={`/users/edit/${user.uuid}`}>Edit</Link></button>
                            </td>
                        </tr>
                    ))}
            </PagedTableComponent>
        </div>
    </>
};

export default UsersPage;
