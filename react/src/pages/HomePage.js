import { useContext, useState } from 'react';
import { useParams } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { LoginAndValidEnvRequired } from "../utils/LoginUtils";
import * as URL from "../utils/URL";
import COOKIE from "../utils/COOKIE";
import CLIENT from "../utils/CLIENT";
import UTIL from '../utils/UTIL';
import UUID from '../utils/UUID';
import TIME from '../utils/TIME';

const HomePage = (props) => {

    const [ header ] = useContext(GlobalContext);

    return <LoginAndValidEnvRequired>
        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <b>Note</b>
                <p />
                <span>
                    This is an <b>experimental</b> version of Foursight using <b><a href="https://reactjs.org/tutorial/tutorial.html" style={{color:"darkred"}} target="_blank">React</a></b>. <br />
                    For more info click <b><a href="https://hms-dbmi.atlassian.net/wiki/spaces/~627943f598eae500689dbdc7/pages/2882699270/Foursight+React" style={{color:"darkred"}} target="_blank"><u>here</u></a></b> or
                    contact: <b><a href="mailto:david_michaels@hms.harvard.edu" style={{color:"darkred",textDecoration:"none"}}>david_michaels@hms.harvard.edu</a></b>
                    <br />
                    To go to the <b>real</b> Foursight click <a href={CLIENT.IsLocal() && window.location.host == "localhost:3000" ? ("http://localhost:8000" + ("/api/view/" + header?.env?.public_name)) : ("/api/view/" + (header?.env?.public_name))} style={{color:"inherit"}}><b><u>here</u></b></a>. <br />
                </span>
            </div>
        </div>
    </LoginAndValidEnvRequired>
};

export default HomePage;
