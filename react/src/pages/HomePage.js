import { useContext } from 'react';
import Auth from '../utils/Auth';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Env from '../utils/Env';
import HeaderData from '../HeaderData';
import Image from '../utils/Image';
import Logout from '../utils/Logout';
import Time from '../utils/Time';
import { HorizontalLine, Link, LoggedInUser } from '../Components';

const HomePage = (props) => {

    const [ header ] = useContext(HeaderData);
    const versionsToolTip = (Env.IsFoursightFourfront(header) ? "foursight" : "foursight-cgap") + ": " + header?.versions?.foursight_core + " / foursight-core: " + header?.versions?.foursight + " / dcicutils: " + header?.versions?.dcicutils;


    const XyzzyComponent = () => {
        const AbcCom = () => {
            return <div className="box">
                AbcCom
            </div>
        }
        const DefCom = () => {
            return <div className="box">
                DefCom
            </div>
        }
        const list = [
            <AbcCom />,
            <DefCom />
        ];
        return <div className="box lighten">
            { list.map(item => 
                    {return item}
            )}
        </div>
    }

    return <>
        <XyzzyComponent />
        <div className="container" style={{marginTop:"-16pt"}}>
            <div className="box lighten" style={{margin:"20pt",padding:"10pt"}}>
                <b>Welcome to Foursight</b> ({Env.IsFoursightFourfront(header) ? 'Fourfront' : 'CGAP'})
                <div style={{float:"right",fontSize:"x-small",textAlign:"right"}}>
                    Foursight Version: <b className="tool-tip" data-text={versionsToolTip}>{header?.versions?.foursight}&nbsp;</b> <br />
                    <span className="tool-tip" data-text={"AWS Account Alias: " + header?.app?.credentials?.aws_account_name}>AWS Account: <b>{header?.app?.credentials?.aws_account_number}</b></span>
                </div>
                <HorizontalLine top="10pt" bottom="4pt" />
                This is the <b>new</b> React version of Foursight. To use the previous version click <b><a href={Env.LegacyFoursightLink(header)} style={{color:"inherit"}}><u>here</u></a></b>.
                <HorizontalLine top="4pt" bottom="10pt" />
                <p />
                <ul>
                    <li> To view Foursight <b><Link to="/checks">checks</Link></b> click <b><Link to="/checks"><u>here</u></Link></b>.  </li>
                    <li> To view Foursight <b><Link to="/env">environments</Link></b> info click <b><Link to="/env"><u>here</u></Link></b>. </li>
                    <li> To view Foursight <b><Link to="/info">general</Link></b> info click <b><Link to="/info"><u>here</u></Link></b>.  </li>
                    <li> To view Foursight <b><Link to="/users">users</Link></b> click <b><Link to="/users"><u>here</u></Link></b>.  </li>
                    <li> To view <b><Link to="/aws/s3">AWS S3</Link></b> info click <b><Link to="/aws/s3"><u>here</u></Link></b>.  </li>
                </ul>
            </div>
            <div className="box lighten thickborder" style={{margin:"20pt",padding:"10pt",marginTop:"-10pt"}}>
                You are logged in as: <LoggedInUser />
                <br />
                To view <b><Link to="/login">login</Link></b> info click <b><Link to="/login"><u>here</u></Link></b>. <br />
                To <b onClick={Logout}><Link>logout</Link></b> click <b onClick={Logout}><Link><u>here</u></Link></b>.
            </div>
        </div>
    </>
};

export default HomePage;
