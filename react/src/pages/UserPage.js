import { useParams, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { Link } from '../Components';
import { RingSpinner, StandardSpinner } from '../Spinners';
import useFetch from '../hooks/Fetch';
import { FetchErrorBox } from '../Components';
import Char from '../utils/Char';
import Client from '../utils/Client';
import DateTime from '../utils/DateTime';
import Env from '../utils/Env';
import Styles from '../Styles';
import Time from '../utils/Time';
import Type from '../utils/Type';
import Tooltip from '../components/Tooltip';
import UserDefs from './UserDefs';
import Yaml from '../utils/Yaml';
import useHeader from '../hooks/Header';

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
            {props.inputs.map((key, i) => <React.Fragment key={key.name}>
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
                                {key.ui(props.value)}
                            </span>:<span className="pointer" onClick={() => setToggle(value => ({...value, [key.label]: true}))}>
                                <small><u>Show</u> {Char.UpArrowHollow}</small>
                            </span> }
                        </>:<>
                            { key.mapWithUser ? <>
                                {(Type.IsFunction(key.map) ? key.map(props.value, props.value[key.name]) : props.value[key.name]) || Char.EmptySet}
                            </>:<>
                                {(Type.IsFunction(key.map) ? key.map(props.value[key.name]) : props.value[key.name]) || Char.EmptySet}
                            </> }
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

    const header = useHeader();
    const user = props.user;
    const userInfo = UserDefs.useUserInfo();
    const inputs = UserDefs.useUserInputs("view");

    let xinputs = [
        { label: "Email", name: "email" },
        { label: "First Name", name: "first_name" },
        { label: "Last Name", name: "last_name" },
        { label: "Groups", name: "group_titles" },
        ...userInfo.affiliations(),
        { label: "Status", name: "status_title" },
        { label: "Created", name: "created", map: value => DateTime.Format(value) },
        { label: "Updated", name: "updated", map: value => DateTime.Format(value) },
        { label: "UUID", name: "uuid" }
    ]

/* ... xyzzy ...
    if (Env.IsFoursightFourfront(useHeader())) {
        items = items.filter(item => (item.name !== "institution") && (item.name !== "project") && (item.name !== "roles") && (item.name !== "role"));
    }
*/

    return <>
                [[{JSON.stringify(props.user)}]]
        <KeyValueBox inputs={inputs} value={props.user} separators={true} />
    </>
}


const UserPage = (props) => {

    const { email } = useParams()
    const [ showRaw, setShowRaw ] = useState(false);
    const navigate = useNavigate();
    const userInfo = UserDefs.useUserInfo();

    function useFetchUser() {
        return useFetch({
            url: `/users/${email}`,
            onData: (data) => {
                data = Type.IsObject(data) ? [data] : data
                userInfo.normalizeUsers(data);
                return data;
            },
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
