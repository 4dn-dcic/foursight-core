import { useContext } from 'react';
import { useParams } from 'react-router-dom';
import GlobalContext from "./GlobalContext";
import { LoginAndValidEnvRequired } from "./LoginUtils";
import { IsRunningLocally } from './LoginUtils.js';
import { NotePageLastVisited } from './LoginUtils';
import * as URL from "./URL";

const Home = (props) => {
    NotePageLastVisited();

    const [ header ] = useContext(GlobalContext);
    let { environ } = useParams();

    return <LoginAndValidEnvRequired>
        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <b>Home Page</b>
                <p />
                This is an experimental React version of Foursight. <br />
                Click <b><a style={{color:"inherit"}} href={IsRunningLocally() && window.location.host == "localhost:3000" ? "http://localhost:8000/api/view" : ("/api/view/" + environ)}>here</a></b> to go to the real version of Foursight. <br />
                <small>
                    For more info: david_michaels@hms.harvard.edu
                </small>
            </div>
        </div>
    </LoginAndValidEnvRequired>
};

export default Home;
