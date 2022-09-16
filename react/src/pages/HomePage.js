import { useContext, useState } from 'react';
import { useParams } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { LoginAndValidEnvRequired } from "../utils/LoginUtils";
import * as URL from "../utils/URL";
import COOKIE from "../utils/COOKIE";
import CLIENT from "../utils/CLIENT";
import UTIL from '../utils/UTIL';
import UUID from '../utils/UUID';
import SERVER from '../utils/SERVER';
import TIME from '../utils/TIME';
import TYPE from '../utils/TYPE';

const HomePage = (props) => {

    const [ header ] = useContext(GlobalContext);

    const linkToNonReactFoursight =
              SERVER.IsLocalCrossOrigin()
              ? (SERVER.Origin() + "/api/view/" + CLIENT.Env(header))
              : ("/api/view/" + CLIENT.Env(header));

    return <LoginAndValidEnvRequired>
        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
<img src={"https://i.stack.imgur.com/DPBue.png"} style={{height:"35",verticalAlign:"bottom"}} />
                {/* <span style={{fontSize:"xx-large"}}>&#x26A0;</span> */}
                <b style={{fontSize:"x-large"}}> Note</b>
                <p />
                <span>
                    This is an <b>experimental</b> version of Foursight using <b><a href="https://reactjs.org/tutorial/tutorial.html" style={{color:"#8A6D3B"}} target="_blank">React</a></b>. <br />
                    To go to the <b>real</b> Foursight click <a href={linkToNonReactFoursight} style={{color:"darkred"}}><b><u>here</u></b></a>. <br />
                    <hr style={{borderTop:"1px solid darkred",marginTop:"8",marginBottom:"8"}}/>
                    <small>
                        For more info click <b><a href="https://hms-dbmi.atlassian.net/wiki/spaces/~627943f598eae500689dbdc7/pages/2882699270/Foursight+React" style={{color:"#8A6D3B"}} target="_blank"><u>here</u></a></b> or
                        contact: <b><a href="mailto:david_michaels@hms.harvard.edu" style={{color:"#8A6D3B",textDecoration:"none"}}>david_michaels@hms.harvard.edu</a></b>
                    </small>
                </span>
            </div>
        </div>
    </LoginAndValidEnvRequired>
};

export default HomePage;
