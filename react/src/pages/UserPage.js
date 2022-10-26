import { Link, useParams } from 'react-router-dom';
import { RingSpinner } from '../Spinners';
import { useFetch } from '../utils/Fetch';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Server from '../utils/Server';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

const UserPage = (props) => {

    const { email } = useParams()
    const response = useFetch(Server.Url(`/users/${email}`), { onData: (data) => Type.IsObject(data) ? [data] : data });

    if (response.error) return <>Cannot load user ({email}) from Foursight: {response.error}</>;
    if (response.loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={response.loading} color={'blue'} size={90} />
            </div>
        </>
    }
    return <>
        <div className="container">
            {response.length > 0 && response.map(user => (
                <div key={user.uuid}>
                    <div style={{fontWeight:"bold",marginBottom:"6px"}}>
                        {user.email} <small style={{fontWeight:"normal"}}>({user.uuid})</small>
                        <b className="tool-tip" data-text="Click to refresh." style={{float:"right",cursor:"pointer"}} onClick={response.refresh}>{Char.Refresh}&nbsp;</b>
                        <span style={{fontWeight:"normal",float:"right"}}><Link to={Client.Path(`/users/edit/${user.uuid}`)} style={{fontWeight:"normal"}}>Edit</Link> |&nbsp;</span>
                    </div>
                    <pre className="info">
                        {Yaml.Format(user)}
                    </pre>
                </div>
            ))}
        </div>
    </>
};

export default UserPage;
