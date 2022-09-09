import { useContext } from 'react';
import { useState } from 'react';
import GlobalContext from "./GlobalContext.js";
import { LoginAndValidEnvRequired } from "./LoginUtils.js";
import * as URL from "./URL";
import ReactTooltip from 'react-tooltip';
import { Tooltip } from './Tooltip';

const Home = (props) => {
    const [ tooltip, showTooltip ] = useState(true);

        console.log("HOME")
        console.log(window.location)
        console.log(window.location.domain)
        console.log(window.location.origin)

    const [ info ] = useContext(GlobalContext);
        let x = "a";
    return <LoginAndValidEnvRequired>
                <ReactTooltip id="xyz">
                adf
                </ReactTooltip>
                <p ref={ref => x = ref} data-for="xyz" data-tip="hello world" onClick={() => { ReactTooltip.hide("xyz"); console.log("Clik"); }}>Tooltip</p>
                <b onClick={() => { ReactTooltip.hide(); console.log("clik"); }}>goaway</b>
                <br/>
                <br/>

              <button data-tip data-for="registerTip" onClick={() => { ReactTooltip.hide("registerTip"); console.log("CLCKCCC"); }}>
                Register
              </button>
                <br/>

              { tooltip && <ReactTooltip id="registerTip" place="top" effect="solid"> Tooltip for the register button </ReactTooltip> }
              <b onMouseEnter={() => showTooltip(true)} onMouseLeave={() => { showTooltip(false); setTimeout(() => showTooltip(true), 1); }}>adfdaf</b>
                <br/>
                <br/>
                thisone
        <div>
                <Tooltip text="afdaf">
                                        <img src="https://cdn-icons-png.flaticon.com/512/32/32223.png" style={{paddingBottom:"4px",height:"22"}} />
                </Tooltip>
        </div>

        <div className="container">
            <div className="boxstyle check-warn" style={{margin:"20pt",padding:"10pt",color:"#6F4E37"}}>
                <b>Home Page</b>: TODO
            </div>
        </div>
    </LoginAndValidEnvRequired>
};

export default Home;
