import { useContext } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import Page from "../Page";
import SERVER from '../utils/SERVER';
import CLIENT from '../utils/CLIENT';

const NotFoundPage = (props) => {

    const [ info ] = useContext(GlobalContext);

    return <Page.AuthorizationRequired>
        <div className="container" id="login_container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt"}}>
                <b>Page not found</b>.
                <br />
                <small>
                Click <Link to={CLIENT.Path("/home", CLIENT.Env(info))} style={{color:"#6F4E37"}}><b>here</b></Link> to go to return to the <Link to={CLIENT.Path("/home", CLIENT.Env(info))}><b style={{color:"6F4E37"}}>home</b></Link> page.
                </small>
            </div>
        </div>
    </Page.AuthorizationRequired>
};

export default NotFoundPage;
