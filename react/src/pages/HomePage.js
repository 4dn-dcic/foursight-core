import { useContext } from 'react';
import Char from '../utils/Char';
import Env from '../utils/Env';
import HeaderData from '../HeaderData';

const HomePage = (props) => {

    const [ header ] = useContext(HeaderData);

    return <>
        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <span style={{fontSize:"xx-large"}}>{Char.Warning}</span>&nbsp;
                <b style={{fontSize:"x-large"}}> Note ...</b>
                <p />
                <span>
                    <hr style={{borderTop:"1px solid darkred",marginTop:"8",marginBottom:"8"}}/>
                    This is an <b>experimental</b> version of Foursight using <b><a href="https://reactjs.org/tutorial/tutorial.html" style={{color:"#8A6D3B"}} target="_blank" rel="noreferrer">React</a></b>. <br />
                    To go to the <b>real</b> Foursight click <a href={Env.LegacyFoursightLink(header)} style={{color:"darkred"}}><b><u>here</u></b></a>. <br />
                    <hr style={{borderTop:"1px solid darkred",marginTop:"8",marginBottom:"8"}}/>
                    <small>
                        For more info contact: <b><a href="mailto:david_michaels@hms.harvard.edu" style={{color:"#8A6D3B",textDecoration:"none"}}>david_michaels@hms.harvard.edu</a></b>
                    </small>
                </span>
            </div>
        </div>
    </>
};

export default HomePage;
