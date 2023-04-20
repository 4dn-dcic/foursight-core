import { useState } from 'react';
import Char from '../utils/Char';
import Time from '../utils/Time';

const PortalAccessKey = (props) => {
    const accessKey = props.accessKey;
    const color = props.error ? "darkred" : "inhert";
    const tdstyle = { fontSize: "11pt", color: color, verticalAlign: "top", paddingBottom: "2pt", paddingRight: "10pt", whiteSpace: "nowrap" };
    const tdlabel = { ...tdstyle, width: "1%" };
    const [ showJson, setShowJson ] = useState(false);
    if (!accessKey) return <></>
    return <>
        <table width="100%"><tbody>
            <tr>
                <td style={tdlabel}>Access Key:</td>
                <td style={tdstyle}>
                    {accessKey.key}
                </td>
            </tr>
            <tr>
                <td style={tdlabel}>Access Key Secret:</td>
                <td style={tdstyle}>
                    {accessKey.secret}
                </td>
            </tr>
            <tr>
                <td style={tdlabel}>Expiration Date:</td>
                <td style={tdstyle}>
                    {accessKey.expires_at}
                    { accessKey.expired ? <>
                        &nbsp;&nbsp;{Char.RightArrow}&nbsp;&nbsp;<b><u>Expired</u></b>&nbsp;&nbsp;{Char.LeftArrow}
                        &nbsp;&nbsp;<small>{Time.Ago(accessKey.expires_at, true, false)}</small>
                    </>:<>
                        &nbsp;{Char.RightArrow}
                        &nbsp;<small>{Time.FromNow(accessKey.expires_at, true, false)}</small>
                    </> }
                </td>
            </tr>
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
