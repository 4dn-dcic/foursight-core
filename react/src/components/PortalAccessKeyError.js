import Char from '../utils/Char';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import { FetchErrorBox, HorizontalLine } from '../Components';
import PortalAccessKey from '../components/PortalAccessKey';

const PortalAccessKeyError = (props) => {
    const header = props.header;
    const tdstyle = { fontSize: "11pt", color: "darkred", verticalAlign: "top", paddingBottom: "3pt", paddingRight: "10pt" };
    return <>
        <div className="container" style={{width:"800pt"}}>
        <div className="box error thickborder">
            <img src="https://cdn.pixabay.com/photo/2015/06/09/16/12/no-access-803719_1280.png" height="30" style={{paddingBottom:"3pt"}}/>
            <b style={{fontSize:"16pt", marginLeft:"10pt"}}>Access Key Error</b><br />
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
            There is a problem with the access key for the <b>Portal</b> associated with this Foursight instance:
                &nbsp;<b><small><a href={header?.portal?.url} style={{color:"darkred"}} target="_blank" >{header?.portal?.url}</a></small></b> <br />
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
            <b>{Char.RightArrow} <small><i>You <u>must</u> contact your system adminstrator to resolve this issue</i>&nbsp;&nbsp;:-(</small></b>
            <HorizontalLine top="6pt" bottom="6pt" color="darkred" />
            <PortalAccessKey accessKey={header?.portal_access_key} error={true} />
        </div></div>
    </>
}

export default PortalAccessKeyError;
