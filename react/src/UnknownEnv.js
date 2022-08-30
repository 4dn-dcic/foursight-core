import { useContext } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { LoginRequired } from "./LoginUtils.js";
import * as URL from './URL.js';

const UnknownEnv = (props) => {

    const [ info ] = useContext(GlobalContext);

    return <LoginRequired>
        <div className="container" id="login_container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt"}}>
                <b>Unknown environment</b>.
                <br />
                <small>
                Click <Link to={URL.Url("/home", true)} style={{color:"6F4E37"}}><b>here</b></Link> to go to return to the <Link to={URL.Url("/home", true)}><b style={{color:"6F4E37"}}>home</b></Link> page.
                </small>
            </div>
        </div>
    </LoginRequired>
};

export default UnknownEnv;
