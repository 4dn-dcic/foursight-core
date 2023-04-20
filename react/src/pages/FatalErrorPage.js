import useHeader from '../hooks/Header';
import PortalAccessKeyError from '../components/PortalAccessKeyError';
import SslCertificateError from '../components/SslCertificateError';

const IsFatalError = (header) => {
    return IsSslCertificateFatalError(header) || IsPortalAccessKeyFatalError(header);
}

const IsPortalAccessKeyFatalError = (header) => {
    return header?.portal_access_key_error;
}

const IsSslCertificateFatalError = (header) => {
    return header?.portal?.ssl_certificate_error;
}

const FatalErrorPage = (props) => {
    const header = useHeader();
    return <>
        { (IsPortalAccessKeyFatalError(header)) &&
            <PortalAccessKeyError header={header} />
        }
        { (IsSslCertificateFatalError(header)) &&
            <SslCertificateError header={header} />
        }
    </>
}

FatalErrorPage.IsFatalError = IsFatalError;

export default FatalErrorPage;
