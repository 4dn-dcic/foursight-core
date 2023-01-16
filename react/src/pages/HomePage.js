import { useEffect, useState } from 'react';
import Client from '../utils/Client';
import Env from '../utils/Env';
import { ExternalLink } from '../Components';
import Image from '../utils/Image';
import Logout from '../utils/Logout';
import { HorizontalLine, Link, LoggedInUser } from '../Components';
import Tooltip from '../components/Tooltip';
import { AccountInfo } from './AccountsComponent';
import useHeader from '../hooks/Header';
import useReadOnlyMode from '../hooks/ReadOnlyMode';
import ReadOnlyModeComponent from '../hooks/ReadOnlyModeComponent';
import Cookie from '../utils/Cookie';
import { withAuthenticator, Button, Heading } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import awsExports from '../aws-config';
import { Auth } from '@aws-amplify/auth'
import Amplify from "aws-amplify";
import { CognitoHostedUIIdentityProvider } from "@aws-amplify/auth";


const HomePage = (props) => {

        useEffect(() => {
            console.log('DO TEST SIGNUP')
            console.log(CognitoHostedUIIdentityProvider)
            const email = "david_michaels@hms.harvard.edu";
            const password = ".0Harvard";
            const firstName = "David";
            const lastName = "Michaels";
            const signUpData = {
                username: email,
                password,
                attributes: { given_name: firstName, family_name: lastName },
            }
            // Auth.signUp(signUpData);
            const signInData = {
                usename: email,
                password
            };
            console.log('signInData')
            console.log(signInData)
            console.log('signInData/b')
            // Auth.signIn(email, password);
            console.log(Auth.federatedSignIn)
            //Auth.federatedSignIn({ provider: "Google", oauth: { redirectSignIn: "http://localhost:8000" } });
            //Auth.federatedSignIn({ provider: CognitoHostedUIIdentityProvider.Google });
            //Auth.federatedSignIn({ provider: "Googlex" });
            //Auth.federatedSignIn({ provider: "Google" });
        }, []);

        function federatedSignIn() {
            //Auth.federatedSignIn({ provider: CognitoHostedUIIdentityProvider.Google });
            //Auth.federatedSignIn({ provider: "Google" });
            Auth.federatedSignIn();
        }

    const header = useHeader();
    const versionsToolTip = (Env.IsFoursightFourfront(header) ? "foursight" : "foursight-cgap") + ": "
                          + header?.versions?.foursight_core + " | foursight-core: "
                          + header?.versions?.foursight + " | dcicutils: " + header?.versions?.dcicutils;

    const account = {
        id: `${header.app?.credentials?.aws_account_name}:${header?.app?.stage}`,
        name: header.app?.credentials?.aws_account_name,
        stage: header.app?.stage
    }

    const [ showAccountSummary, setShowAccountSummary ] = useState(false);

    return <>
<span className="pointer" onClick={federatedSignIn}>SIGNIN</span>
        <div className="container" style={{marginTop:"-16pt"}}>
            <div className="box lighten" style={{margin:"20pt",padding:"10pt"}}>
                <b style={{fontSize:"x-large"}}>Welcome to Foursight &nbsp;<span style={{fontWeight:"normal"}}>({Env.IsFoursightFourfront(header) ? 'Fourfront' : 'CGAP'})</span></b>
                <div style={{float:"right",fontSize:"x-small",textAlign:"right",marginTop:"-3pt",marginRight:"2pt"}}>
                    <span id="tooltip-home-versions">Foursight Version: <b>{header?.versions?.foursight}</b></span> <br />
                    <Tooltip id="tooltip-home-versions" position="top" size="small" text={versionsToolTip} />
                    { header?.app?.credentials?.aws_account_name ? <>
                        <span id="tooltip-home-aws-account">AWS Account: <b>{header?.app?.credentials?.aws_account_name}</b></span> <br />
                        <Tooltip id="tooltip-home-aws-account" position="top" size="small" text={"AWS Account Number: " + header?.app?.credentials?.aws_account_number} />
                    </>:<>
                        <span>AWS Account: <b>{header?.app?.credentials?.aws_account_number}</b></span> <br />
                    </>}
                    Foursight Stage: <b>{header?.app?.stage}</b> <br />
                </div>
                <HorizontalLine top="10pt" bottom="4pt" />
                This is the <b>new</b> React version of Foursight. To use the previous version click <b><a href={Env.LegacyFoursightLink(header)} style={{color:"inherit"}}><u>here</u></a></b>.
                <span id={"tooltip-account-summary"}style={{float:"right",marginTop:"-3pt"}} className="pointer" onClick={() => setShowAccountSummary(!showAccountSummary)}>
                    <img alt="settings" src={Image.SettingsRedIcon()} height="28" />
                </span>
                <Tooltip id="tooltip-account-summary" position="top" size="small" text={"Click to " + (showAccountSummary ? "hide" : "show") + " account summary."} />
                <HorizontalLine top="4pt" bottom="10pt" />
                { showAccountSummary && <>
                    { <div style={{marginBottom:"12pt"}}><AccountInfo account={account} header={header} decrementAccountCount={() => {}} all={true} brighten={true} /></div> }
                </>}
                <p />
                <ul>
                    <li> To view Foursight <b><Link to="/checks">checks</Link></b> click <b><Link to="/checks"><u>here</u></Link></b>.  </li>
                    <li> To view Foursight <b><Link to="/info">general</Link></b> info click <b><Link to="/info"><u>here</u></Link></b>.  </li>
                    <li> To view Foursight <b><Link to="/env">environments</Link></b> info click <b><Link to="/env"><u>here</u></Link></b>. </li>
                    <li> To view Foursight <b><Link to="/users">users</Link></b> click <b><Link to="/users"><u>here</u></Link></b>.  </li>
                    <li> To view <b><Link to="/aws/s3">AWS S3</Link></b> info click <b><Link to="/aws/s3"><u>here</u></Link></b>.  </li>
                    <li> To view <b><Link to="/aws/infrastructure">AWS infrastructure</Link></b> info click <b><Link to="/aws/infrastructure"><u>here</u></Link></b>.  </li>
                </ul>
            </div>
            <div className="box thickborder" style={{margin:"20pt",padding:"10pt",marginTop:"-10pt"}}>
                You are logged in as: <LoggedInUser />
                <br />
                To view your <b><Link to="/login">session</Link></b> info click <b><Link to="/login"><u>here</u></Link></b>. <br />
                To <b onClick={Logout}><Link>logout</Link></b> click <b onClick={Logout}><Link><u>here</u></Link></b>.
            </div>
            { (true || header.app?.accounts_file || header.app?.accounts_file_from_s3) && <>
                <div className="box lighten" style={{fontSize:"small",margin:"20pt",padding:"5pt 10pt 5pt 10pt",marginTop:"-10pt"}}>
                    {/* Click <Link to="/accounts?all=true">here</Link> to view all <Link to="/accounts?all=true" bold={false}>known accounts</Link>. */}
                    Click <a href={Client.Path("/accounts?all=true")} rel="noreferrer" target="_blank" style={{color:"var(--box-fg)"}}><b>here</b></a> to view all <a href={Client.Path("/accounts?all=true")} style={{color:"var(--box-fg)"}} rel="noreferrer" target="_blank"><b>known accounts</b></a>.
                    <ExternalLink
                        href={Client.Path("/accounts?all=true")}
                        bold={true}
                        style={{marginLeft:"6pt"}} />
                </div>
            </>}
        </div>
    </>
};

export default HomePage;
