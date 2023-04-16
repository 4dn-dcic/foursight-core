import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import useHeader from '../hooks/Header';
import Auth0Lock from 'auth0-lock';
import Auth from '../utils/Auth';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import { FetchErrorBox, HorizontalLine } from '../Components';
import Cookie from '../utils/Cookie';
import Env from '../utils/Env';
import Image from '../utils/Image';
import Json from '../utils/Json';
import LiveTime from '../LiveTime';
import { LoggedInUser, Link } from '../Components';
import { LoginCognitoBox } from './LoginCognitoBox';
import Logout from '../utils/Logout';
import Server from '../utils/Server';
import Time from '../utils/Time';
import Tooltip from '../components/Tooltip';
import Yaml from '../utils/Yaml';
import Page from '../Page';
import useFetch from '../hooks/Fetch';

const IsFatalError = (header) => {
    return header?.portal?.ssl_certificate_error;
}

const FatalError = (props) => {
    if (!IsFatalError(props.header)) return <></>
    return <>
        <SslCertificateErrorBox header={props.header} />
    </>
}

FatalError.IsFatalError = IsFatalError;

const SslCertificateErrorBox = (props) => {
    const header = props.header;
    const tdstyle = { fontSize: "11pt", color: "darkred", verticalAlign: "top", paddingBottom: "3pt", paddingRight: "10pt" };
    const [ showDetails, setShowDetails ] = useState(false);
    return <>
        <div className="container" style={{width:"800pt"}}>
        <div className="box error thickborder">
            <img src="https://cdn0.iconfinder.com/data/icons/reject-filled-color/64/reject_cross_cancel_remove_accept_diploma_certificate0-1024.png" height="35" />
            <b style={{fontSize:"16pt", marginLeft:"10pt"}}>SSL Certificate Error</b><br />
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
            There is a problem with the SSL certificate for the <b>Portal</b> associated with this Foursight instance:
                &nbsp;<b><small><a href={header.portal.url} style={{color:"darkred"}} target="_blank" >{header.portal.url}</a></small></b> <br />
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
            <b><small><i>You must contact your system adminstrator to resolve this issue</i>&nbsp;&nbsp;:-(</small></b>
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
                <table><tbody>
                <tr><td style={tdstyle}>Hostname:</td><td style={tdstyle}><b>{header.portal.ssl_certificate.hostname}</b></td></tr>
                <tr>
                    <td style={tdstyle}>Owner:</td>
                    <td style={tdstyle}>
                        {header.portal.ssl_certificate.owner}
                        { header.portal.ssl_certificate.owner_entity && <>
                            &nbsp;({header.portal.ssl_certificate.owner_entity})
                        </> }
                    </td>
                </tr>
                <tr>
                    <td style={tdstyle}>Issuer:</td>
                    <td style={tdstyle}>
                        {header.portal.ssl_certificate.issuer}
                        { header.portal.ssl_certificate.issuer_entity && <>
                            &nbsp;({header.portal.ssl_certificate.issuer_entity})
                        </> }
                    </td>
                </tr>
                <tr>
                    <td style={tdstyle}>Activation Date:</td>
                    <td style={tdstyle}>
                        {header.portal.ssl_certificate.active_at}
                        { header.portal.ssl_certificate.inactive && <b style={{color:"darkred"}}>
                            &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;<b><u>Inactive</u></b>&nbsp;&nbsp;{Char.LeftArrow}
                        </b> }
                    </td>
                </tr>
                <tr>
                    <td style={tdstyle}>Expiration Date:</td>
                    <td style={tdstyle}>
                        {header.portal.ssl_certificate.expires_at}
                        { header.portal.ssl_certificate.expired && <>
                            &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;<b><u>Expired</u></b>&nbsp;&nbsp;{Char.LeftArrow}
                            &nbsp;&nbsp;<small>{Time.Ago(header.portal.ssl_certificate.expires_at)}</small>
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
                    <tr><td style={tdstyle}>Serial Number:</td><td style={tdstyle}>{header.portal.ssl_certificate.serial_number}</td></tr>
                    <tr>
                        <td style={tdstyle}>
                            PEM:
                        </td>
                        <td style={tdstyle}>
                            <pre style={{background:"inherit", color: "inherit", marginTop:"2pt"}}>
                                {header.portal.ssl_certificate.pem}
                            </pre>
                        </td>
                    </tr>
                </> }
                </tbody></table>
        </div></div>
    </>
}

export default FatalError;
