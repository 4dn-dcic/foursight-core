import { useState } from 'react';
import Auth from '../utils/Auth';
import Char from '../utils/Char';
import Time from '../utils/Time';
import useHeader from '../hooks/Header';

const PortalAccessKey = (props) => {
    const header = useHeader();
    const accessKey = props.accessKey;
    const color = props.error ? "darkred" : "inhert";
    const tdstyle = { fontSize: "11pt", color: color, verticalAlign: "top", paddingBottom: "2pt", paddingRight: "10pt", whiteSpace: "nowrap" };
    const tdlabel = { ...tdstyle, width: "1%" };
    const [ showDetails, setShowDetails ] = useState(false);
    const [ showJson, setShowJson ] = useState(false);
    if (!accessKey) return <></>
    return <>
        <table width="100%"><tbody>
            <tr>
                <td style={tdlabel}>Portal:</td>
                <td style={tdstyle}>
                    <a href={`${accessKey.server}`} target="_blank">{accessKey.server}</a>
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
            <tr>
                <td style={tdlabel}>Access Key:</td>
                <td style={tdstyle}>
                    {accessKey.key}
                    { Auth.IsLoggedIn(header) && <>
                        &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;
                        <a href={`${accessKey.server}/access-keys/${accessKey.key}/`} style={{color:color}} target="_blank">View</a>
                    </> }
                </td>
            </tr>
            <tr>
                <td style={tdlabel}>Creation Date:</td>
                <td style={tdstyle}>
                    {accessKey.created_at}
                    &nbsp;{Char.RightArrow}
                    &nbsp;<small>{Time.Ago(accessKey.created_at, true, false)}</small>
                </td>
            </tr>
            <tr>
                <td style={tdlabel}>Expiration Date:</td>
                <td style={tdstyle}>
                    {accessKey.expires_at}
                    { accessKey.expires_at ? <>
                        { accessKey.expired ? <>
                            &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;<b><u>Expired</u></b>&nbsp;&nbsp;{Char.LeftArrow}
                            &nbsp;&nbsp;<small>{Time.Ago(accessKey.expires_at, true, false)}</small>
                        </>:<>
                            &nbsp;{Char.RightArrow}
                            &nbsp;<small>{Time.FromNow(accessKey.expires_at, true, false)}</small>
                        </> }
                    </>:<>
                        None
                    </> }
                </td>
            </tr>
            { accessKey.exception &&
                <tr>
                    <td style={tdlabel}>Details:</td>
                    <td style={tdstyle}>
                        { showDetails ? <>
                            <span onClick={() => setShowDetails(false)} style={{cursor:"pointer"}}>
                                <u>Hide</u> {Char.DownArrow}
                            </span>
                        </>:<>
                            <span onClick={() => setShowDetails(true)} style={{cursor:"pointer"}}>
                                <u>Show</u> {Char.UpArrow}
                            </span>
                        </> }
                    </td>
                </tr>
            }
            { showDetails && <>
                { accessKey.exception &&
                    <tr>
                        <td style={tdlabel}>Error:</td>
                        <td style={{...tdstyle,whiteSpace:"pre-wrap"}}>
                            {accessKey.exception}
                        </td>
                    </tr>
                }
            </> }
            { showJson && <>
                <tr><td style={{height:"2pt"}}></td></tr>
                <tr>
                    <td colSpan="2">
                        <pre style={{background:"inherit", color: color, marginTop:"2pt",whiteSpace:"pre-wrap"}}>
                            {JSON.stringify(accessKey, null, 2)}
                        </pre>
                    </td>
                </tr>
            </> }
        </tbody></table>
    </>
}

export default PortalAccessKey;
