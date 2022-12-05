import React from 'react';
import { useContext } from 'react';
import Env from '../utils/Env';
import HeaderData from '../HeaderData';
import Logout from '../utils/Logout';
import { HorizontalLine, Link, LoggedInUser } from '../Components';

const HomePage = (props) => {

    const [ header ] = useContext(HeaderData);
    const versionsToolTip = `Deployed: ${header?.app?.deployed} / `
                          + (Env.IsFoursightFourfront(header) ? "foursight" : "foursight-cgap") + ": "
                          + header?.versions?.foursight_core + " / foursight-core: "
                          + header?.versions?.foursight + " / dcicutils: " + header?.versions?.dcicutils;

    return <>
        <div className="container" style={{marginTop:"-16pt"}}>
            <div className="box lighten" style={{margin:"20pt",padding:"10pt"}}>
                <b style={{fontSize:"x-large"}}>Welcome to Foursight &nbsp;<span style={{fontWeight:"normal"}}>({Env.IsFoursightFourfront(header) ? 'Fourfront' : 'CGAP'})</span></b>
                <div style={{float:"right",fontSize:"x-small",textAlign:"right",marginTop:"-3pt",marginRight:"2pt"}}>
                    Foursight Version: <b className="tool-tip" data-text={versionsToolTip}>{header?.versions?.foursight}</b> <br />
                    { header?.app?.credentials?.aws_account_name ? <>
                        <span className="tool-tip" data-text={"AWS Account Number: " + header?.app?.credentials?.aws_account_number}>AWS Account: <b>{header?.app?.credentials?.aws_account_name}</b></span> <br />
                    </>:<>
                        <span>AWS Account: <b>{header?.app?.credentials?.aws_account_number}</b></span> <br />
                    </>}
                    Foursight Stage: <b>{header?.app?.stage}</b> <br />
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
                    { (header.app?.accounts_file || header.app?.accounts_file_from_s3) &&
                        <li> To view other <b><Link to="/accounts">accounts</Link></b> info click <b><Link to="/accounts"><u>here</u></Link></b>.  </li>
                    }
                </ul>
            </div>
            <div className="box lighten thickborder" style={{margin:"20pt",padding:"10pt",marginTop:"-10pt"}}>
                You are logged in as: <LoggedInUser />
                <br />
                To view your <b><Link to="/login">session</Link></b> info click <b><Link to="/login"><u>here</u></Link></b>. <br />
                To <b onClick={Logout}><Link>logout</Link></b> click <b onClick={Logout}><Link><u>here</u></Link></b>.
            </div>
            { (header.app?.accounts_file || header.app?.accounts_file_from_s3) && <>
                <div className="box" style={{margin:"20pt",padding:"10pt",marginTop:"-10pt"}}>
                    Click <Link to="/accounts">here</Link> to view other <Link to="/accounts" bold={false}>known accounts</Link>.
                </div>
            </>}
        </div>
    </>
};

export default HomePage;
