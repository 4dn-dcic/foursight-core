import { useContext } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { LoginRequired } from "../utils/LoginUtils";
import * as URL from '../utils/URL';
import SERVER from '../utils/SERVER';
import CLIENT from '../utils/CLIENT';

const NotFoundPage = (props) => {

    const [ info ] = useContext(GlobalContext);

    return <LoginRequired>
            ServerOrigin: {SERVER.Origin()} <br />
            ServerBasePath: {SERVER.BasePath()}  <br />
            ServerBaseUrl: {SERVER.BaseUrl()} <br />
            ServerUrlExample: {SERVER.Url("/example-one")} <br />
            ClientOrigin: {CLIENT.Origin()} <br />
            ClientBasePath: {CLIENT.BasePath()} <br />
            ClientBaseUrl: {CLIENT.BaseUrl()} <br />
            ClientPathExample: {CLIENT.Path("/example-one")} <br />
            ClientPathWithEnvExample: {CLIENT.Path("/example-one", "some-env")} <br />
            CurrentEnv: [{CLIENT.Env()}] <br />
            CURENT CurrentEnv: [{URL.Env()}] <br />
            FOO: [{CLIENT.Path("", true)}] <br />
            GOO: [{URL.Url("", true)}] <br />
                current logical path: [{CLIENT.CurrentLogicalPath()}] <br />
            foobar: [{CLIENT.Path(null, "foobar")}] <br/>
            env: [{CLIENT.Env(info)}]

        <div className="container" id="login_container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt"}}>
                <b>Page not found</b>.
                <br />
                <small>
                Click <Link to={CLIENT.Path("/home", CLIENT.Env(info))} style={{color:"#6F4E37"}}><b>here</b></Link> to go to return to the <Link to={URL.Url("/home", CLIENT.Env(info))}><b style={{color:"6F4E37"}}>home</b></Link> page.
                </small>
            </div>
        </div>
    </LoginRequired>
};

export default NotFoundPage;
