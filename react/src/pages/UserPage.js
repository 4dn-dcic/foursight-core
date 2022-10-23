import { useParams } from 'react-router-dom';
import { RingSpinner } from '../Spinners';
import { useFetch } from '../utils/Fetch';
import Char from '../utils/Char';
import Server from '../utils/Server';
import Yaml from '../utils/Yaml';

const UserPage = (props) => {

    const { email } = useParams()
    const response = useFetch(Server.Url(`/users/${email}`));

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
                <div key={user.record.uuid}>
                    <div style={{fontWeight:"bold",marginBottom:"6px"}}>
                        {user.record?.email} <small style={{fontWeight:"normal"}}>({user.record?.uuid})</small>
                        <b className="tool-tip" data-text="Click to refresh." style={{float:"right",cursor:"pointer"}} onClick={response.refresh}>{Char.Refresh}&nbsp;</b>
                    </div>
                        <pre className="info">
                            {Yaml.Format(user.record)}
                        </pre>
                </div>
            ))}
        </div>
    </>
};

export default UserPage;
