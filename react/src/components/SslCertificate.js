import { useState } from 'react';
import Char from '../utils/Char';
import Time from '../utils/Time';

const SslCertificate = (props) => {
    const certificate = props.certificate;
    const color = props.error ? "darkred" : "inhert";
    const tdstyle = { fontSize: "11pt", color: color, verticalAlign: "top", paddingBottom: "2pt", paddingRight: "10pt" };
    const [ showDetails, setShowDetails ] = useState(false);
    if (!certificate) return <></>
    return <>
        <table><tbody>
            { certificate.name &&
                <tr>
                    <td style={tdstyle}>Certificate For:</td>
                    <td style={tdstyle}>
                        {certificate.name}
                    </td>
                </tr>
            }
            <tr><td style={tdstyle}>Hostname:</td><td style={tdstyle}><b>{certificate.hostname}</b></td></tr>
            <tr>
                <td style={tdstyle}>Owner:</td>
                <td style={tdstyle}>
                    {certificate.owner}
                    { certificate.owner_entity && <>
                        &nbsp;({certificate.owner_entity})
                    </> }
                </td>
            </tr>
            <tr>
                <td style={tdstyle}>Issuer:</td>
                <td style={tdstyle}>
                    {certificate.issuer}
                    { certificate.issuer_entity &&
                     (certificate.issuer != certificate.issuer) && <>
                        &nbsp;({certificate.issuer_entity})
                    </> }
                </td>
            </tr>
            <tr>
                <td style={tdstyle}>Activation Date:</td>
                <td style={tdstyle}>
                    {certificate.active_at}
                    { certificate.inactive && <b style={{color:color}}>
                        &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;<b><u>Inactive</u></b>&nbsp;&nbsp;{Char.LeftArrow}
                    </b> }
                </td>
            </tr>
            <tr>
                <td style={tdstyle}>Expiration Date:</td>
                <td style={tdstyle}>
                    {certificate.expires_at}
                    { certificate.expired ? <>
                        &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;<b><u>Expired</u></b>&nbsp;&nbsp;{Char.LeftArrow}
                        &nbsp;&nbsp;<small>{Time.Ago(certificate.expires_at)}</small>
                    </>:<>
                        &nbsp;{Char.RightArrow}
                        &nbsp;<small>{Time.FromNow(certificate.expires_at)}</small>
                    </> }
                </td>
            </tr>
            <tr>
                <td style={tdstyle}>
                    Details:
                </td>
                <td style={tdstyle}>
                    { showDetails ? <>
                        <span onClick={() => setShowDetails(false)} style={{cursor:"pointer"}}>
                            Hide {Char.DownArrow}
                        </span>
                    </>:<>
                        <span onClick={() => setShowDetails(true)} style={{cursor:"pointer"}}>
                            Show {Char.UpArrow}
                        </span>
                    </> }
                </td>
            </tr>
            { showDetails && <>
                <tr><td style={tdstyle}>Serial Number:</td><td style={tdstyle}>{certificate.serial_number}</td></tr>
                <tr>
                    <td style={tdstyle}>
                        PEM:
                    </td>
                    <td style={tdstyle}>
                        <pre style={{background:"inherit", color: "inherit", marginTop:"2pt"}}>
                            {certificate.pem}
                        </pre>
                    </td>
                </tr>
                <tr>
                    <td style={tdstyle}>
                        Public Key:
                    </td>
                    <td style={tdstyle}>
                        <pre style={{background:"inherit", color: "inherit", marginTop:"2pt"}}>
                            {certificate.public_key_pem}
                        </pre>
                    </td>
                </tr>
            </> }
        </tbody></table>
    </>
}

export default SslCertificate;
