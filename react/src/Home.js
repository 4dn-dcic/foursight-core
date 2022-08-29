import { useContext } from 'react';
import GlobalContext from "./GlobalContext.js";
import { LoginAndValidEnvRequired } from "./LoginUtils.js";
import * as URL from "./URL";

const Home = (props) => {

        console.log("HOME")
        console.log(window.location)
        console.log(window.location.domain)
        console.log(window.location.origin)

    const [ info ] = useContext(GlobalContext);
    return <LoginAndValidEnvRequired>
        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <b>Home Page</b>: TODO
            </div>
        </div>
    </LoginAndValidEnvRequired>
};

export default Home;
