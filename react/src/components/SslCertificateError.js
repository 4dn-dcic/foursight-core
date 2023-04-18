import Char from '../utils/Char';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import { FetchErrorBox, HorizontalLine } from '../Components';
import SslCertificate from '../components/SslCertificate';

const SslCertificateError = (props) => {
    const header = props.header;
    const tdstyle = { fontSize: "11pt", color: "darkred", verticalAlign: "top", paddingBottom: "3pt", paddingRight: "10pt" };
    return <>
        <div className="container" style={{width:"800pt"}}>
        <div className="box error thickborder">
            <img src="https://cdn0.iconfinder.com/data/icons/reject-filled-color/64/reject_cross_cancel_remove_accept_diploma_certificate0-1024.png" height="35" />
            <b style={{fontSize:"16pt", marginLeft:"10pt"}}>SSL Certificate Error</b><br />
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
            There is a problem with the SSL certificate for the <b>Portal</b> associated with this Foursight instance:
                &nbsp;<b><small><a href={header.portal.url} style={{color:"darkred"}} target="_blank" >{header.portal.url}</a></small></b> <br />
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
            <b>{Char.RightArrow} <small><i>You <u>must</u> contact your system adminstrator to resolve this issue</i>&nbsp;&nbsp;:-(</small></b>
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
            <SslCertificate certificate={header.portal.ssl_certificate} error={true} />
        </div></div>
    </>
}

export default SslCertificateError;
