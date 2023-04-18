import { useSearchParams } from 'react-router-dom';
import useHeader from '../hooks/Header';
import useFetch from '../hooks/Fetch';
import SslCertificate from '../components/SslCertificate';

const SslCertificatePage = (props) => {
    const [ args ] = useSearchParams();
    const hostname = args.get("hostname");
    const certificates = useFetch(`/certificates?hostname=${hostname}`);
    return <>
        <div className="container" style={{width:"800pt"}}>
            <b>Certificates</b>
            { certificates?.data?.map(certificate => <div key={certificate.serial_number}>
                <SslCertificateBox certificate={certificate} />
            </div>)}
        </div>
    </>
}

const SslCertificateBox = (props) => {
    return <>
        <div className="box thickborder" style={{marginBottom:"6pt"}}>
            <SslCertificate certificate={props.certificate} />
        </div>
    </>
}

export default SslCertificatePage;
