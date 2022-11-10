import { Link as ReactLink } from 'react-router-dom';
import Auth from './utils/Auth';
import Client from './utils/Client';
import Image from './utils/Image';
import Time from './utils/Time';

export const Link = ({to, env = true, tip = null, bold = true, children}) => {
    return <ReactLink className={tip ? "tool-tip" : ""} data-text={tip} to={Client.Path(to, env ? env : null)} style={{color:"inherit",fontWeight:bold ? "bold" : "inherit"}}>{children}</ReactLink>
    return tip ? <ReactLink className={tip ? "tool-tip" : ""} data-text={tip} to={Client.Path(to, env ? env : null)} style={{color:"inherit",fontWeight:bold ? "bold" : "inherit"}}>{children}</ReactLink>
               : <ReactLink to={Client.Path(to, env ? env : null)} style={{color:"inherit",fontWeight:bold ? "bold" : "inherit"}}>{children}</ReactLink>
}

export const HorizontalLine = ({top = "0", bottom = "0"}) => {
    return <div className="fgbg" style={{height:"1px",marginTop:top,marginBottom:bottom}}></div>
}

export const LoggedInUser = ({ link = undefined}) => {
    if (link === "user") {
        link = "/users/" + Auth.LoggedInUser();
    }
    else if (link == undefined) {
        link = "/login";
    }
    return <>
        { (link) ? <>
            <Link to={link} tip={Time.Ago(Auth.LoggedInAt())}>{Auth.LoggedInUser()}</Link>
        </>:<>
            <span className="tool-tip" data-text={Time.Ago(Auth.LoggedInAt())}>{Auth.LoggedInUser()}</span>
        </>}
        { Auth.LoggedInViaGoogle() ? <>
            <span className="tool-tip" data-text="Google Authentication">
                <img title="Via Google" style={{marginLeft:"9px",marginRight:"0",marginBottom:"2px"}} src={Image.GoogleLoginLogo()} height="15" />
            </span>
        </>:<>
            { Auth.LoggedInViaGitHub() && <>
                <span className="tool-tip" data-text="GitHub Authentication">
                    <img title="Via GitHub" style={{marginLeft:"5px",marginRight:"-4px",marginBottom:"2px"}} src={Image.GitHubLoginLogo()} height="19" />
                </span>
            </>}
        </>}
    </>
}
