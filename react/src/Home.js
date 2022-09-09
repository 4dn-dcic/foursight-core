import { useContext } from 'react';
import { useParams } from 'react-router-dom';
import GlobalContext from "./GlobalContext";
import { LoginAndValidEnvRequired } from "./LoginUtils";
import { DeleteCookie } from './CookieUtils';
import * as URL from "./URL";

const Home = (props) => {

    // Temporary so React and non-React version can live better side-by-side.
    // This is set in Login.js when the Auth0 login box is shown.
    // This is used in foursight_core/app_utils.py/auth0_callback.
    //
    DeleteCookie("redir_react");

    const [ header ] = useContext(GlobalContext);
    let { environ } = useParams();

    return <LoginAndValidEnvRequired>
        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <b>Home Page</b>
                <p />
                This is an experimental React version of Foursight. <br />
                Click <b><a style={{color:"inherit"}} href={"/api/view/" + environ}>here</a></b> to go to the real version of Foursight. <br />
                <small>
                    For more info: david_michaels@hms.harvard.edu
                </small>
            </div>
        </div>
    </LoginAndValidEnvRequired>
};

export default Home;
