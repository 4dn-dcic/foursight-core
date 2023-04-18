import useHeader from '../hooks/Header';
import SslCertificateError from '../components/SslCertificateError';

const IsFatalError = (header) => {
    return header?.portal?.ssl_certificate_error;
}

const FatalErrorPage = (props) => {
    const header = useHeader();
    if (!IsFatalError(header)) return <></>
    return <>
        <SslCertificateError header={header} />
    </>
}

FatalErrorPage.IsFatalError = IsFatalError;

export default FatalErrorPage;
