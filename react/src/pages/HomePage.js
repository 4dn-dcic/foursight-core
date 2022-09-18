import { useContext, useState } from 'react';
import { useParams } from 'react-router-dom';
import Global from "../Global";
import ENV from "../utils/ENV";
import SERVER from '../utils/SERVER';

const HomePage = (props) => {

    const [ header ] = useContext(Global);

    return <>
        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <span style={{fontSize:"xx-large"}}>&#x26A0;</span>&nbsp;
                <b style={{fontSize:"x-large"}}> Note ...</b>
                <p />
                <span>
                    <hr style={{borderTop:"1px solid darkred",marginTop:"8",marginBottom:"8"}}/>
                    This is an <b>experimental</b> version of Foursight using <b><a href="https://reactjs.org/tutorial/tutorial.html" style={{color:"#8A6D3B"}} target="_blank">React</a></b>. <br />
                    To go to the <b>real</b> Foursight click <a href={ENV.LegacyFoursightLink(header)} style={{color:"darkred"}}><b><u>here</u></b></a>. <br />
                    <hr style={{borderTop:"1px solid darkred",marginTop:"8",marginBottom:"8"}}/>
                    <small>
                        For more info click <b><a href="https://hms-dbmi.atlassian.net/wiki/spaces/~627943f598eae500689dbdc7/pages/2882699270/Foursight+React" style={{color:"#8A6D3B"}} target="_blank"><u>here</u></a></b> or
                        contact: <b><a href="mailto:david_michaels@hms.harvard.edu" style={{color:"#8A6D3B",textDecoration:"none"}}>david_michaels@hms.harvard.edu</a></b>
                    </small>
                </span>
            </div>
        </div>
    </>
};

export default HomePage;
