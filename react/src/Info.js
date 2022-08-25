import { useContext, useEffect } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";

const Info = (props) => {
    console.log("Info Page")
    const [info, setInfo] = useContext(GlobalContext);

    useEffect(() => {
         console.log('USE-EFFECT!! Info')
         if (!info.loading) {
            setInfo(JSON.parse(JSON.stringify(info)))
         }
    }, []);

  return (<>

    { (info.loading) ? (<span>
            foo
        loading
    </span>):(<span>

      <h1>Info:</h1>

    <ul className="top-level-list">
        <b>Miscellany</b>
        <div className="info boxstyle">
            <h5 style={{margin:"10px 5px 10px 5px"}}>
                <div className="row">
                    <div className="col-sm-4">
                        <div style={{padding:"0",align:"left"}}>
                            <b>App Launched At:</b>
                        </div>
                    </div>
                    <div className="col-sm-8" style={{wordWrap:"break-word"}} align="left">
                        {info.app.launched}
                    </div>
                </div>
            </h5>
        </div>
    </ul>

    </span>)}

    </>);
};

export default Info;
