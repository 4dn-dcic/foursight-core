import { useSearchParams } from 'react-router-dom';
import useHeader from '../hooks/Header';
import useFetch from '../hooks/Fetch';
import PortalAccessKey from '../components/PortalAccessKey';

const PortalAccessKeyPage = (props) => {
    const accessKey = useFetch("/portal_access_key");
    return <>
        <div className="container" style={{width:"800pt"}}>
            <b>Portal Access Key</b>
            <div className="box thickborder" style={{marginBottom:"6pt"}}>
                <PortalAccessKey accessKey={accessKey.data} />
            </div>
        </div>
    </>
}

export default PortalAccessKeyPage;
