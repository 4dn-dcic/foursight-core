import { useParams } from 'react-router-dom';
import { RingSpinner } from '../Spinners';
import Server from '../utils/Server';
import { useFetch } from '../utils/Fetch';
import Yaml from '../utils/Yaml';

const UserPage = (props) => {

    const { email } = useParams()
    const [ response, refresh ] = useFetch(Server.Url(`/users/${email}`));

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
            {response.data?.length > 0 && response.data.map(user => (
                <div key={user.record.uuid}>
                    <div style={{fontWeight:"bold",marginBottom:"6px"}}>
                        {user.email_address}
                        <b className="tool-tip" data-text="Click to refresh." style={{float:"right",cursor:"pointer"}} onClick={() => refresh()}>&#8635;&nbsp;</b>
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
