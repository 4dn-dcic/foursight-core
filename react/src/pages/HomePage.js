import { useContext } from 'react';
import { Link } from 'react-router-dom';
import Auth from '../utils/Auth';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Env from '../utils/Env';
import HeaderData from '../HeaderData';
import Image from '../utils/Image';
import Logout from '../utils/Logout';

const HomePage = (props) => {

    const [ header ] = useContext(HeaderData);
    const tdStyle = { paddingRight: "8pt", paddingBottom: "4pt", verticalAlign:"top" }

    return <>
        <div className="container" style={{marginTop:"-16pt"}}>
            <div className="boxstyle" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <b>Welcome to Foursight</b>
                <p />
                <table style={{width:"100%"}}><tbody>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="2"></td></tr>
                    <tr><td style={{height:"6pt"}} colSpan="2"></td></tr>
                    <tr><td colSpan="2">
                        This is the <b>new</b> React version of Foursight. To use the previous version click <b><a href={Env.LegacyFoursightLink(header)}>here</a></b>.
                        </td>
                    </tr>
                    <tr><td style={{height:"6pt"}} colSpan="2"></td></tr>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="2"></td></tr>
                    <tr><td style={{height:"12pt"}} colSpan="2"></td></tr>
                    <tr>
                        <td style={{...tdStyle,width:"1%"}}>{Char.Dot}</td>
                        <td style={tdStyle}>
                            To view Foursight <b><Link to={Client.Path("/checks")} style={{color:"inherit"}}>checks</Link></b> click <b><Link to={Client.Path("/checks")}>here</Link></b>.
                        </td>
                    </tr>
                    <tr>
                        <td style={tdStyle}>{Char.Dot}</td>
                        <td style={tdStyle}>
                            To view Foursight <b><Link to={Client.Path("/env")} style={{color:"inherit"}}>environment(s)</Link></b> click <b><Link to={Client.Path("/env")}>here</Link></b>.
                        </td>
                    </tr>
                    <tr>
                        <td style={tdStyle}>{Char.Dot}</td>
                        <td style={tdStyle}>
                            To view Foursight <b><Link to={Client.Path("/info")} style={{color:"inherit"}}>general info</Link></b> click <b><Link to={Client.Path("/info")}>here</Link></b>.
                        </td>
                    </tr>
                    <tr>
                        <td style={tdStyle}>{Char.Dot}</td>
                        <td style={tdStyle}>
                            To view Foursight <b><Link to={Client.Path("/users")} style={{color:"inherit"}}>users</Link></b> click <b><Link to={Client.Path("/users")}>here</Link></b>.
                        </td>
                    </tr>
                    <tr>
                        <td style={tdStyle}>{Char.Dot}</td>
                        <td style={tdStyle}>
                            To view <b><Link to={Client.Path("/aws/s3")} style={{color:"inherit"}}>AWS S3</Link></b> info click <b><Link to={Client.Path("/aws/s3")}>here</Link></b>.
                        </td>
                    </tr>
                </tbody></table>
            </div>
            <div className="boxstyle" style={{margin:"20pt",padding:"10pt",marginTop:"-10pt",color:"#6F4E37"}}>
                You are logged in as: <b><Link to={Client.Path("/login")} style={{color:"inherit"}}>{Auth.LoggedInUser()}</Link></b>
                { Auth.LoggedInViaGoogle(header) ? <>
                    <span className="tool-tip" data-text="Google Authentication">
                        <img title="Via Google" style={{marginLeft:"9px",marginRight:"0",marginBottom:"2px"}} src={Image.GoogleLoginLogo()} height="15" />
                    </span>
                </>:<>
                    { Auth.LoggedInViaGitHub(header) && <>
                        <span className="tool-tip" data-text="GitHub Authentication">
                            <img title="Via GitHub" style={{marginLeft:"5px",marginRight:"-4px",marginBottom:"2px"}} src={Image.GitHubLoginLogo()} height="19" />
                        </span>
                    </>}
                </>}
                <br />
                To view <b><Link to={Client.Path("/login")} style={{color:"inherit"}}>login</Link></b> info click <b><Link to={Client.Path("/login")}>here</Link></b>. <br />
                To <b onClick={Logout}><Link style={{color:"inherit"}}>logout</Link></b> click <b onClick={Logout}><Link>here</Link></b>.
            </div>
        </div>
    </>
};

export default HomePage;
