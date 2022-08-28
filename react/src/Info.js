import { useContext } from 'react';
import GlobalContext from "./GlobalContext.js";
import { LoginRequired } from "./LoginUtils.js";

const Info = () => {

    const [ info ] = useContext(GlobalContext);

    if (info.error) return <>Cannot load Foursight.</>;
    if (info.loading) return <>Loading ...</>;
    return <LoginRequired>
            <div className="container">
            <b>Info</b>
        <ul className="top-level-list">
            <div className="info boxstyle">
                <h5 style={{margin:"10px 5px 10px 5px"}}>
                    <div className="row">
                        <div className="col-sm-4">
                            <div style={{padding:"0",align:"left"}}>
                                <b>App Launched At:</b>
                            </div>
                        </div>
                        <div className="col-sm-8" style={{wordWrap:"break-word"}} align="left">
                            {info.app?.launched}
                        </div>
                    </div>
                </h5>
            </div>
        </ul>
                </div>
    </LoginRequired>
};

export default Info;
