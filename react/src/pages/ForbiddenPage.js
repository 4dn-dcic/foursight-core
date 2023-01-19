import { Link } from 'react-router-dom';
import Env from '../utils/Env';
import Client from '../utils/Client';
import Logout from '../utils/Logout';
import useHeader from '../hooks/Header';

const ForbiddenPage = (props) => {

    const header = useHeader();

    return <>
        <div className="container" id="login_container">
            <div className="boxstyle check-error" style={{margin:"20pt",padding:"10pt"}}>
                <b>Forbidden response from server.</b>.  <br />
                You seem to be logged in but the server does not seem to think so. <br />
                Try <span onClick={() => Logout()} style={{cursor:"pointer"}}><u>logging out</u></span> and logging in again.
                <br />
                <small>
                Click <Link to={Client.Path("/login", Env.Current(header))} style={{color:"darkred"}}><b>here</b></Link> to go to the <Link to={Client.Path("/login", Env.Current(header))}><b style={{color:"darkred"}}>login</b></Link> page.
                </small>
            </div>
        </div>
    </>
};

export default ForbiddenPage;
