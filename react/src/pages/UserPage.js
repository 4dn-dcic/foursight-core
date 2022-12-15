import { useParams, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import { Link } from '../Components';
import { RingSpinner, StandardSpinner } from '../Spinners';
import { useFetch } from '../utils/Fetch';
import { FetchErrorBox } from '../Components';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Server from '../utils/Server';
import Styles from '../Styles';
import Time from '../utils/Time';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

const UserRawBox = (props) => {
    const user = useFetch(Server.Url(`/users/${props.email}?raw=true`), { cache: true });
    return <pre className="box">
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
                        {key.label}:
                    </td>
                    <td style={tdContentStyle}>
                        {Type.IsFunction(key.map) ? key.map(props.value[key.name]) : props.value[key.name]}
                    </td>
                </tr>
            </React.Fragment>)}
        </tbody></table>
    </div>
}

const UserBox = (props) => {

    const items = [
        { label: "Email", name: "email" },
        { label: "First Name", name: "first_name" },
        { label: "Last Name", name: "last_name" },
        { label: "Groups", name: "groups" },
        { label: "Project", name: "project", map: value => value?.replace("/projects/","")?.replace("/","") },
        { label: "Institution", name: "institution", map: value => value?.replace("/institutions/","")?.replace("/","") },
        { label: "Created", name: "created", map: value => Time.FormatDateTime(value) },
        { label: "Updated", name: "updated", map: value => Time.FormatDateTime(value) },
        { label: "UUID", name: "uuid" }
    ]

    return <KeyValueBox keys={items} value={props.user} separators={true} />
}

const UserPage = (props) => {

    const { email } = useParams()
    const response = useFetch(Server.Url(`/users/${email}`), { onData: (data) => Type.IsObject(data) ? [data] : data, cache: true });
    const [ showRaw, setShowRaw ] = useState(false);
    const navigate = useNavigate();

    function toggleRaw() {
        setShowRaw(value => !value);
    }

    if (response.error) return <FetchErrorBox error={response.error} message={`Cannot load user (${email}) from Foursight`} center={true} />
    if (response.loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={response.loading} color={Styles.GetForegroundColor()} size={90} />
            </div>
        </>
    }
    return <>
        <div className="container" style={{width:"fit-content",minWidth:"550pt",maxWidth:"800pt"}}>
            <div style={{marginBottom:"2pt"}}>
                <b>User</b>
                <div style={{float:"right",fontSize:"small",marginTop:"2pt"}}>
                    <span className="pointer" onClick={toggleRaw}>
                        {showRaw ? <b>Raw</b> : <span>Raw</span>}<>&nbsp;|&nbsp;</>
                    </span>
                    { response.length == 1 && <>
                        <Link to={`/users/edit/${response.get(0)?.uuid}`} bold={false}>Edit</Link><>&nbsp;|&nbsp;</>
                    </>}
                    <Link to="/users" bold={false}>List</Link><>&nbsp;|&nbsp;</>
                    <Link to="/users/create" bold={false}>Create</Link><>&nbsp;|&nbsp;</>
                    <b className="tool-tip" data-text="Click to refresh." style={{float:"right",cursor:"pointer"}} onClick={response.refresh}>{Char.Refresh}&nbsp;</b>
                </div>
            </div>
            {response.length > 0 && response.map(user => (
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
