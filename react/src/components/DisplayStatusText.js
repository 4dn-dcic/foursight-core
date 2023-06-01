import Styles from '../Styles';
import Str from '../utils/Str';

const DisplayStatusText = ({ status }) => {
    status = status?.toLowerCase(status).trim() || ""
    function isStatusOkay(status) {
        return status == "ok" || status == "done" || status.includes("pass") || status.includes("success");
    }
    function isStatusWarning(status) {
        return status == "warn" || status == "warning"
    }
    function isStatusError(status) {
        return status.includes("error") || status.includes("fail") || status.includes("exception");
    }
    function isStatusUnknown(status) {
        return !Str.HasValue(status);
    }
    if (isStatusOkay(status)) {
        return <b style={{color:Styles.GetForegroundColor()}}>OK</b>
    }
    else if (isStatusWarning(status)) {
        return <b style={{color:Styles.GetForegroundColor()}}>WARNING</b>
    }
    else if (isStatusError(status)) {
        return <b style={{color:"darkred"}}>ERROR</b>
    }
    else if (isStatusUnknown(status)) {
        return <b style={{color:"red"}}>UNKNOWN</b>
    }
    else {
        return <b style={{color:"black"}}>{status}</b>
    }
}

export default DisplayStatusText;
