import { useContext } from 'react';
import { Link } from 'react-router-dom';
import Global from "../Global";
import ENV from '../utils/ENV';
import Client from '../utils/Client';
import LOGOUT from '../utils/LOGOUT';

const ForbiddenPage = (props) => {

    const [ header ] = useContext(Global);

    return <>
        <div className="container" id="login_container">
            <div className="boxstyle check-error" style={{margin:"20pt",padding:"10pt"}}>
                <b>Forbidden response from server.</b>.  <br />
                You seem to be logged in but the server does not seem to think so. <br />
                Try <span onClick={() => LOGOUT()} style={{cursor:"pointer"}}><u>logging out</u></span> and logging in again.
                <br />
                <small>
                Click <Link to={Client.Path("/login", ENV.Current(header))} style={{color:"darkred"}}><b>here</b></Link> to go to the <Link to={Client.Path("/login", ENV.Current(header))}><b style={{color:"darkred"}}>login</b></Link> page.
                </small>
            </div>
        </div>
    </>
};

export default ForbiddenPage;
