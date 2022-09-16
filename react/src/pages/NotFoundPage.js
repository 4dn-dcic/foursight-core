import { useContext } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { LoginRequired } from "../utils/LoginUtils";
import * as URL from '../utils/URL';
import SERVER from '../utils/SERVER';
import CLIENT from '../utils/CLIENT';

const NotFoundPage = (props) => {

    const [ info ] = useContext(GlobalContext);

    return <LoginRequired>
        <div className="container" id="login_container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt"}}>
                <b>Page not found</b>.
                <br />
                <small>
                Click <Link to={CLIENT.Path("/home", CLIENT.Env(info))} style={{color:"#6F4E37"}}><b>here</b></Link> to go to return to the <Link to={CLIENT.Path("/home", CLIENT.Env(info))}><b style={{color:"6F4E37"}}>home</b></Link> page.
                </small>
            </div>
        </div>
    </LoginRequired>
};

export default NotFoundPage;
