import { useState } from 'react';
import Char from '../utils/Char';
import Time from '../utils/Time';

const SslCertificate = (props) => {
    const certificate = props.certificate;
    const color = props.error ? "darkred" : "inhert";
    const tdstyle = { fontSize: "11pt", color: color, verticalAlign: "top", paddingBottom: "2pt", paddingRight: "10pt", whiteSpace: "nowrap" };
    const tdlabel = { ...tdstyle, width: "1%" };
    const [ showDetails, setShowDetails ] = useState(false);
    const [ showJson, setShowJson ] = useState(false);
    if (!certificate) return <></>
    return <>
        <table width="100%"><tbody>
            { certificate.name &&
                <tr>
                    <td style={tdlabel}>Certificate For:</td>
                    <td style={tdstyle}>
                        <u>{certificate.name}</u>
                        <small style={{float:"right", marginRight:"-10pt"}}><b>
                            { showJson ? <>
                                <span onClick={() => setShowJson(false)} style={{cursor:"pointer"}}>
                                    JSON&nbsp;{Char.DownArrow}
                                </span>
                            </>:<>
                                <span onClick={() => setShowJson(true)} style={{cursor:"pointer"}}>
                                    JSON&nbsp;{Char.UpArrow}
                                </span>
                            </> }
                        </b></small>
                    </td>
                </tr>
            }
            <tr>
                <td style={tdlabel}>Hostname:</td>
                <td style={tdstyle}><b>
                    {certificate.hostname}</b>
                    { !certificate.name &&
                        <small style={{float:"right", marginRight:"-10pt"}}><b>
                            { showJson ? <>
                                <span onClick={() => setShowJson(false)} style={{cursor:"pointer"}}>
                                    JSON&nbsp;{Char.DownArrow}
                                </span>
                            </>:<>
                                <span onClick={() => setShowJson(true)} style={{cursor:"pointer"}}>
                                    JSON&nbsp;{Char.UpArrow}
                                </span>
                            </> }
                        </b></small>
                    }
                </td>
            </tr>
            { certificate.owner &&
                <tr>
                    <td style={tdlabel}>Owner:</td>
                    <td style={tdstyle}>
                        {certificate.owner}
                        { certificate.owner_entity && (certificate.owner_entity != certificate.owner) && <>
                            &nbsp;({certificate.owner_entity})
                        </> }
                    </td>
                </tr>
            }
            <tr>
                <td style={tdlabel}>Issuer:</td>
                <td style={tdstyle}>
                    {certificate.issuer}
                    { certificate.issuer_entity && (certificate.issuer != certificate.issuer) && <>
                        &nbsp;({certificate.issuer_entity})
                    </> }
                </td>
            </tr>
            <tr>
                <td style={tdlabel}>Activation Date:</td>
                <td style={tdstyle}>
                    {certificate.active_at}
                    { certificate.inactive && <b style={{color:color}}>
                        &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;<b><u>Inactive</u></b>&nbsp;&nbsp;{Char.LeftArrow}
                    </b> }
                </td>
            </tr>
            <tr>
                <td style={tdlabel}>Expiration Date:</td>
                <td style={tdstyle}>
                    {certificate.expires_at}
                    { certificate.expired ? <>
                        &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;<b><u>Expired</u></b>&nbsp;&nbsp;{Char.LeftArrow}
                        &nbsp;&nbsp;<small>{Time.Ago(certificate.expires_at, true, false)}</small>
                    </>:<>
                        &nbsp;{Char.RightArrow}
                        &nbsp;<small>{Time.FromNow(certificate.expires_at, true, false)}</small>
                    </> }
                </td>
            </tr>
            <tr>
                <td style={tdlabel}>Details:</td>
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
                <tr><td style={tdlabel}>Serial Number:</td><td style={tdstyle}>{certificate.serial_number}</td></tr>
                <tr>
                    <td style={tdlabel}>
                        PEM:
                    </td>
                    <td style={tdstyle}>
                        <pre style={{background:"inherit", color: "inherit", marginTop:"2pt"}}>
                            {certificate.pem}
                        </pre>
                    </td>
                </tr>
                <tr>
                    <td style={tdlabel}>
                        Public Key:
                    </td>
                    <td style={tdstyle}>
                        <pre style={{background:"inherit", color: "inherit", marginTop:"2pt"}}>
                            {certificate.public_key_pem}
                        </pre>
                    </td>
                </tr>
            </> }
            { showJson && <>
                <tr><td style={{height:"2pt"}}></td></tr>
                <tr>
                    <td colSpan="2">
                        <pre style={{background:"inherit", color: color, marginTop:"2pt",whiteSpace:"pre-wrap"}}>
                            {JSON.stringify(certificate, null, 2)}
                        </pre>
                    </td>
                </tr>
            </> }
        </tbody></table>
    </>
}

export default SslCertificate;
