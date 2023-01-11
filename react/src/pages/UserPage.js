import { useParams, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { Link } from '../Components';
import { RingSpinner, StandardSpinner } from '../Spinners';
import { useFetch } from '../utils/Fetch';
import { FetchErrorBox } from '../Components';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Env from '../utils/Env';
import Styles from '../Styles';
import Time from '../utils/Time';
import Type from '../utils/Type';
import Tooltip from '../components/Tooltip';
import UserDefs from './UserDefs';
import Yaml from '../utils/Yaml';
import useHeader from '../hooks/Header';
import useUserMetadata from '../hooks/UserMetadata';

const UserRawBox = (props) => {
    const user = useFetch(`/users/${props.email}?raw=true`);
    return <pre className="box">
        <span style={{float:"right",marginTop:"-6pt",fontSize:"large",cursor:"pointer"}} onClick={() => user.refresh()}>{Char.Refresh}</span>
        { user.loading ? <>
            <StandardSpinner />
        </>:<>
            {Yaml.Format(user.data)}
        </>}
    </pre>
}

const KeyValueBox = (props) => {
    const tdLabelStyle = {
        color: "var(--box-fg)",
        fontWeight: "bold",
        fontSize: "small",
        paddingTop: "1pt",
        verticalAlign: "top",
        width: "5%",
        paddingRight: "8pt",
        whiteSpace: "nowrap"
    }
    const tdContentStyle = {
        verticalAlign: "top"
    }
    const [ toggle, setToggle ] = useState({});
    return <div className="box" style={{marginBottom:"8pt"}}>
        <table><tbody>
            {props.keys.map((key, i) => <React.Fragment key={key.name}>
                { props.separators && i > 0 && <>
                    <tr><td colSpan="2" style={{height:"1pt"}}></td></tr>
                    <tr><td colSpan="2" style={{height:"1px",marginTop:"2pt",marginBottom:"2pt",background:"gray"}}></td></tr>
                    <tr><td colSpan="2" style={{height:"1pt"}}></td></tr>
                </>}
                <tr>
                    <td style={tdLabelStyle}>
                        { key.toggle ? <>
                            { toggle[key.label] ? <span className="pointer" onClick={() => setToggle(value => ({...value, [key.label]: false}))}>
                                {key.label}:
                            </span>:<span className="pointer" onClick={() => setToggle(value => ({...value, [key.label]: true}))}>
                                {key.label}:
                            </span> }
                        </>:<>
                            {key.label}:
                        </> }
                    </td>
                    <td style={tdContentStyle}>
                        { key.ui ? <>
                            { toggle[key.label] ? <span className="pointer" onClick={() => setToggle(value => ({...value, [key.label]: false}))}>
                                <small><u>Hide</u> {Char.DownArrowHollow}</small>
                                {key.ui}
                            </span>:<span className="pointer" onClick={() => setToggle(value => ({...value, [key.label]: true}))}>
                                <small><u>Show</u> {Char.UpArrowHollow}</small>
                            </span> }
                        </>:<>
                            {(Type.IsFunction(key.map) ? key.map(props.value[key.name]) : props.value[key.name]) || Char.EmptySet}
                        </> }
                        { key.subComponent && <>
                            <br /> {key.subComponent(props.value[key.name])}
                        </> }
                    </td>
                </tr>
            </React.Fragment>)}
        </tbody></table>
    </div>
}
const UserBox = (props) => {

    const userMetadata = useUserMetadata();

    let items = [
        { label: "Email", name: "email" },
        { label: "First Name", name: "first_name" },
        { label: "Last Name", name: "last_name" },
        { label: "Groups", name: "groups", map: value => userMetadata.titles(value) },
        { label: "Project", name: "project", map: value => userMetadata.projectTitle(value) },
        { label: "Role", name: "role", map: value => value },
        { label: "Roles", name: "roles", ui: <RolesBox user={props.user} />, toggle: true },
        { label: "Institution", name: "institution", map: value => userMetadata.institutionTitle(value),
                                subComponent: (institution) => <UserDefs.PrincipalInvestigatorLine institution={institution} /> },
        { label: "Status", name: "status", map: value => userMetadata.statusTitle(value) },
        { label: "Created", name: "created", map: value => Time.FormatDateTime(value) },
        { label: "Updated", name: "updated", map: value => Time.FormatDateTime(value) },
        { label: "UUID", name: "uuid" }
    ]

    if (Env.IsFoursightFourfront(useHeader())) {
        items = items.filter(item => (item.name !== "institution") && (item.name !== "project") && (item.name !== "roles") && (item.name !== "role"));
    }

    return <KeyValueBox keys={items} value={props.user} separators={true} />
}

const RolesBox = (props) => {
    const userMetadata = useUserMetadata();
    return <div className="box lighten" style={{marginTop:"2pt",marginBottom:"2pt"}}>
        <table style={{width:"100%",fontSize:"small",marginTop:"-3pt",marginBottom:"-2pt"}}><tbody>
            <tr>
                <td> <b>Project</b> </td>
                <td style={{paddingLeft:"8pt"}}> <b>Role</b> </td>
            </tr>
            <tr><td style={{height:"2pt"}} /></tr>
            <tr><td style={{height:"1px",background:"var(--box-fg)"}} colSpan="2" ></td></tr>
            <tr><td style={{height:"2pt"}} /></tr>
            { props.user.roles.sort((a,b) => a.project > b.project ? 1 : (a.project < b.project ? -1 : 0)).map(role => <tr key={role.project}>
                <td style={{width:"5%",whiteSpace:"nowrap"}}>
                    {userMetadata.projectTitle(role.project)}
                </td>
                <td style={{paddingLeft:"8pt",whiteSpace:"nowrap"}}>
                    {userMetadata.roleTitle(role.role)}
                </td>
            </tr>)}
        </tbody></table>
    </div>
}

const UserPage = (props) => {

    const { email } = useParams()
    const [ showRaw, setShowRaw ] = useState(false);
    const navigate = useNavigate();

    function useFetchUser() {
        return useFetch({
            url: `/users/${email}`,
            onData: (data) => Type.IsObject(data) ? [data] : data,
            nofetch: true
        });
    }

    const users = useFetchUser();

    useEffect(() => {
        users.fetch();
    }, [email]);

    function toggleRaw() {
        setShowRaw(value => !value);
    }

    if (users.error) return <FetchErrorBox error={users.error} message={`Cannot load user (${email}) from Foursight`} center={true} />
    if (users.loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={users.loading} color={Styles.GetForegroundColor()} size={90} />
            </div>
        </>
    }
    return <>
        <div className="container" style={{width:"fit-content",minWidth:"550pt",maxWidth:"800pt"}}>
            <div style={{marginBottom:"2pt"}}>
                <b>User</b>{users.length === 1 && ": " + users.get(0)?.first_name + " " + users.get(0)?.last_name}
                <div style={{float:"right",fontSize:"small",marginTop:"2pt"}}>
                    <span className="pointer" onClick={toggleRaw}>
                        {showRaw ? <b>Raw</b> : <span>Raw</span>}<>&nbsp;|&nbsp;</>
                    </span>
                    { users.length === 1 && <>
                        <Link to={`/users/edit/${users.get(0)?.uuid}`} bold={false}>Edit</Link><>&nbsp;|&nbsp;</>
                    </>}
                    <Link to="/users" bold={false}>List</Link><>&nbsp;|&nbsp;</>
                    <Link to="/users/create" bold={false}>Create</Link><>&nbsp;|&nbsp;</>
                    <b id="tooltip-users" style={{float:"right",cursor:"pointer"}} onClick={users.refresh}>{Char.Refresh}&nbsp;</b>
                    <Tooltip id={`tooltip-users`} position="top" text={"Click to refresh."} />
                </div>
            </div>
            {users.length > 0 && users.map(user => (
                <div key={user.uuid}>
                    <div className="box lighten" style={{fontWeight:"bold",marginBottom:"6px"}}>
                        {user.email} <small style={{fontWeight:"normal"}}>({user.uuid})</small>
                        <button onClick={() => navigate(Client.Path(`/users/edit/${user.uuid}`))} className="button" style={{float:"right",fontSize:"small",marginTop:"-1pt",marginRight:"2pt"}}>
                            Edit
                        </button>
                    </div>
                    { showRaw ? <UserRawBox email={user.email} /> : <UserBox user={user} /> }
                </div>
            ))}
        </div>
    </>
};

export default UserPage;
