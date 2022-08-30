import { useContext } from 'react';
import GlobalContext from "./GlobalContext";
import { LoginAndValidEnvRequired } from "./LoginUtils";
import * as URL from "./URL";

const Checks = (props) => {

    const [ info ] = useContext(GlobalContext);
    return <LoginAndValidEnvRequired>
        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <b>Checks Page</b>: TODO
            </div>
        </div>
    </LoginAndValidEnvRequired>
};

export default Checks;
