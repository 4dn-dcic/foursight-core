import { Link } from 'react-router-dom';
import useHeader from '../hooks/Header';
import Env from '../utils/Env';
import Client from '../utils/Client';

const NotFoundPage = (props) => {

    const header = useHeader();

    return <>
        <div className="container" id="login_container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt"}}>
                <b>Page not found</b>.
                <br />
                <small>
                Click <Link to={Client.Path("/home", Env.Current(header))} style={{color:"#6F4E37"}}><b>here</b></Link> to return to the <Link to={Client.Path("/home", Env.Current(header))}><b style={{color:"6F4E37"}}>home</b></Link> page.
                </small>
            </div>
        </div>
    </>
};

export default NotFoundPage;
