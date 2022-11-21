import { useParams } from 'react-router-dom';
import { Link } from '../Components';
import { RingSpinner } from '../Spinners';
import { useFetch } from '../utils/Fetch';
import { FetchErrorBox } from '../Components';
import Char from '../utils/Char';
import Server from '../utils/Server';
import Styles from '../Styles';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

const UserPage = (props) => {

    const { email } = useParams()
    const response = useFetch(Server.Url(`/users/${email}`), { onData: (data) => Type.IsObject(data) ? [data] : data });

    if (response.error) return <FetchErrorBox error={response.error} message={`Cannot load user (${email}) from Foursight`} center={true} />
    if (response.loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={response.loading} color={Styles.GetForegroundColor()} size={90} />
            </div>
        </>
    }
    return <>
        <div className="container">
             <b>User Record</b>
             <div style={{float:"right",fontSize:"small"}}>
                <Link to="/users/create" bold={false}>Create User</Link>&nbsp;|&nbsp;
        <b className="tool-tip" data-text="Click to refresh." style={{float:"right",cursor:"pointer"}} onClick={response.refresh}>{Char.Refresh}&nbsp;</b>
            </div>
            {response.length > 0 && response.map(user => (
                <div key={user.uuid}>
                    <div className="box lighten" style={{fontWeight:"bold",marginBottom:"6px"}}>
                        {user.email} <small style={{fontWeight:"normal"}}>({user.uuid})</small>
                        <span style={{float:"right"}}><Link to={`/users/edit/${user.uuid}`} bold={false}><u>Edit</u></Link>&nbsp;&nbsp;</span>
                    </div>
                    <pre className="box">
                        {Yaml.Format(user)}
                    </pre>
                </div>
            ))}
        </div>
    </>
};

export default UserPage;
