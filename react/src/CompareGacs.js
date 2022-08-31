import React from 'react';
import { useContext, useState, useEffect, useReducer } from 'react';
import { useParams } from 'react-router-dom';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "./GlobalContext.js";
import { fetchData } from './FetchUtils';
import { RingSpinner } from "./Spinners";
import { LoginAndValidEnvRequired } from "./LoginUtils";
import * as API from "./API";
import * as URL from "./URL";
import { UUID } from './Utils';
let YAML = require('json-to-pretty-yaml');

const CompareGacs = (props) => {

    let environ = URL.Env();
    let { environCompare } = useParams();
    console.log("CompareGAC(" + environ + "," + environCompare +")")
    const url = API.Url(`/gac/${environCompare}`, environ);
    const [ data, setData ] = useState([]);
    const [ showingRaw, setShowingRaw ] = useState(false);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    const [ info ] = useContext(GlobalContext);
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    useEffect(() => { fetchData(url, setData, setLoading, setError)}, []);
    let navigate = useNavigate();

    function getUniqueKeys(gac, gac_compare) {
        let uniqueKeys = []
        Object.keys(gac).map((key) => {
            if (!uniqueKeys.includes(key)) {
                uniqueKeys.push(key)
            }
        });
        Object.keys(gac_compare).map((key) => {
            if (!uniqueKeys.includes(key)) {
                uniqueKeys.push(key)
            }
        });
        return uniqueKeys.sort();
    }

    function sameGacValue(key, data) {
        return data?.gac_diffs?.same?.includes(key);
    }

    function removedGacValue(key, data) {
        return data?.gac_diffs?.removed?.includes(key);
    }

    function addedGacValue(key, data) {
        return data?.gac_diffs?.added?.includes(key);
    }

    function appearsToBeObfuscated(value) {
        return /^\*+$/.test(value);
    }

    function getGacName(gac) {
        // Should return this explicitly from API.
        return gac["ENCODED_IDENTITY"];
    }

    function showRawData() {
        document.getElementById("cooked").style.display = "none";
        document.getElementById("raw").style.display = "block";
        setShowingRaw(true);
    }
    function showFormattedData() {
        document.getElementById("cooked").style.display = "block";
        document.getElementById("raw").style.display = "none";
        setShowingRaw(false);
    }

    let OnChangeEnv = (arg) => {
        environ = arg.target.value;
        console.log('CompareGacs:onChangeEnv(' + arg.target.value + ')')
        let url = API.Url("/gac/" + environCompare, environ);
        const path = "/api/react/" + environ + "/gac/" + environCompare;
        console.log("CompareGacs:onChangeEnv(" + arg.target.value + "): Navigate(" + path + ")")
        navigate(path);
        fetchData(url, setData, setLoading, setError)
    }

    let OnChangeEnvCompare = (arg) => {
        environCompare = arg.target.value;
        console.log('CompareGacs:onChangeEnvCompare(' + arg.target.value + ')')
        let url = API.Url("/gac/" + environCompare, environ);
        const path = "/api/react/" + environ + "/gac/" + environCompare;
        console.log("CompareGacs:onChangeEnv(" + arg.target.value + "): Navigate(" + path + ")")
        navigate(path);
        fetchData(url, setData, setLoading, setError)
    }

    if (error) return <>Cannot load GAC comparison from Foursight: {error}</>;
    if (loading) return <>Loading content ...</>;

    let unique_keys = getUniqueKeys(data?.gac, data?.gac_compare);
    let unique_annotated_envs = info.envs?.unique_annotated;

//xyzzy
/*
unique_annotated_envs.push(
{
"name": "xyzzy",
"short": "xyzzy",
"full": "cgap-xyzzy",
"public": "xyzzy",
"foursight": "xyzzy",
"gac_name": "C4DatastoreCgapXyzzyApplicationConfiguration"
});
unique_annotated_envs.push(
{
"name": "abc",
"short": "abc",
"full": "cgap-abc",
"public": "abc",
"foursight": "abc",
"gac_name": "C4DatastoreCgapAbcApplicationConfiguration"
});
//xyzzy
*/

    return <LoginAndValidEnvRequired>
            <b>GAC Comparison</b>:&nbsp;&nbsp;
            <small>
                <span style={{cursor:"pointer",color:showingRaw ? "black" : "blue",fontWeight:showingRaw ? "bold" : "normal"}} onClick={() => showRawData()}>RAW</span>&nbsp;|&nbsp;
                <span style={{cursor:"pointer",color:showingRaw ? "blue" : "black",fontWeight:showingRaw ? "normal" : "bold"}} onClick={() =>showFormattedData()}>FORMATTED</span>
            </small>
            <div style={{marginBottom:"4px"}} />
            <div id="cooked" className="boxstyle info">
                <table width="100%">
                    <thead>
                    <tr style={{fontWeight:"bold"}}>
                        <td></td>
                        <td width="30%" style={{verticalAlign:"bottom"}}>Key</td>
                        <td>
                            <select style={{border:"0",fontWeight:"normal",fontStyle:"italic",color:"blue",background:"transparent","-webkit-appearance":"none"}} onChange={(arg) => OnChangeEnv(arg)}>
                                { unique_annotated_envs.map((env) =>
                                    env.full == environ ?
                                        <option selected key={env.full}>{env.full}</option> :
                                        <option key={env.full}>{env.full}</option>
                                )}
                            </select>
                            <br />
                            {getGacName(data?.gac)}
                        </td>
                        <td>
                            <select style={{border:"0",fontWeight:"normal",fontStyle:"italic",color:"blue",background:"transparent","-webkit-appearance":"none"}} onChange={(arg) => OnChangeEnvCompare(arg)}>
                                { unique_annotated_envs.map((env) =>
                                    env.full == environCompare ?
                                        <option selected key={env.full}>{env.full}</option> :
                                        <option          key={env.full}>{env.full}</option>
                                )}
                            </select>
                            <br />
                            {getGacName(data?.gac_compare)}
                        </td>
                    </tr>
                    <tr><td style={{height:"3px"}} colSpan="4"></td></tr>
                    <tr><td style={{height:"1px",background:"darkblue"}} colSpan="4"></td></tr>
                    <tr><td style={{height:"8px"}} colSpan="4"></td></tr>
                    </thead>
                    <tbody style={{fontSize:"10pt"}}>
                    { unique_keys.map((key, keyIndex) => {
                        return <React.Fragment key={UUID()}>
                            <tr key={UUID()} style={{color:sameGacValue(key, data) ? "inherit" : "red"}}>
                            <td>
                                {sameGacValue(key, data) ? <span>&#x2713;</span> : <span>&#x2717;</span>}&nbsp;
                            </td>
                            <td>
                                <b>{key}</b>
                            </td>
                            <td>
                                <span>{addedGacValue(key, data) ? <b>MISSING</b> : ((appearsToBeObfuscated(data.gac[key]) ? <b>OBFUSCATED</b> : data.gac[key]) || <b>&#x2205;</b>)}</span>
                            </td>
                            <td>
                                <span>{removedGacValue(key, data) ? <b>MISSING</b> : ((appearsToBeObfuscated(data.gac_compare[key]) ? <b>OBFUSCATED</b> : data.gac_compare[key]) || <b>&#x2205;</b>)}</span>
                            </td>
                            </tr>
                            { keyIndex < unique_keys.length - 1 ? (<React.Fragment>
                                <tr><td style={{height:"4px"}}></td></tr>
                                <tr><td style={{height:"1px",background:"lightblue"}} colSpan="4"></td></tr>
                                <tr><td style={{height:"3px"}}></td></tr>
                             </React.Fragment>):(<tr/>)}
                        </React.Fragment>})}
                    <tr><td style={{height:"8px"}} colSpan="4"></td></tr>
                    </tbody>
                </table>
            </div>
            <pre id="raw" className="info" style={{display:"none"}}>
                {YAML.stringify(data)}
            </pre>
    </LoginAndValidEnvRequired>
};

export default CompareGacs;
