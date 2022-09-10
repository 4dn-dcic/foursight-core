import React from 'react';
import { useContext, useState, useEffect, useReducer } from 'react';
import { useParams } from 'react-router-dom';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { fetchData } from '../utils/FetchUtils';
import { RingSpinner } from "../Spinners";
import { LoginAndValidEnvRequired } from "../utils/LoginUtils";
import * as API from "../utils/API";
import * as URL from "../utils/URL";
import { UUID } from '../utils/Utils';
let YAML = require('json-to-pretty-yaml');

const GacComparePage = (props) => {

    let environ = URL.Env();
    let { environCompare } = useParams();
    const url = API.Url(`/gac/${environCompare}`, environ);
    const [ data, setData ] = useState([]);
    const [ showingRaw, setShowingRaw ] = useState(false);
    const [ showingType, setShowingType ] = useState("all");
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    const [ info ] = useContext(GlobalContext);
    const [, forceUpdate] = useReducer(x => x + 1, 0);
    useEffect(() => { fetchData(url, setData, setLoading, setError)}, []);
    let navigate = useNavigate();

    function getUniqueKeys(gac, gac_compare) {
        let uniqueKeys = []
        if (!gac || !gac_compare) {
            return uniqueKeys;
        }
        Object.keys(gac)?.map((key) => {
            if (!uniqueKeys.includes(key)) {
                uniqueKeys.push(key)
            }
        });
        Object.keys(gac_compare)?.map((key) => {
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

    function showAll() {
        setShowingType("all");
    }
    function showingAll() {
        return showingType == "all"
    }
    function showingAllLinkStyle() {
        return {
            cursor: "pointer",
            color: showingAll() ? "black" : "blue",
            fontWeight: showingAll() ? "bold" : "normal"
        };
    }

    function showMatches() {
        setShowingType("matches");
    }
    function showingMatches() {
        return showingType == "matches"
    }
    function showingMatchesLinkStyle() {
        return {
            cursor: "pointer",
            color: showingMatches() ? "black" : "blue",
            fontWeight: showingMatches() ? "bold" : "normal"
        };
    }

    function showNonMatches() {
        setShowingType("nonmatches");
    }
    function showingNonMatches() {
        return showingType == "nonmatches"
    }
    function showingNonMatchesLinkStyle() {
        return {
            cursor: "pointer",
            color: showingNonMatches() ? "black" : "blue",
            fontWeight: showingNonMatches() ? "bold" : "normal"
        };
    }

    function showDifferences() {
        setShowingType("differences");
    }
    function showingDifferences() {
        return showingType == "differences"
    }
    function showingDifferencesLinkStyle() {
        return {
            cursor: "pointer",
            color: showingDifferences() ? "black" : "blue",
            fontWeight: showingDifferences() ? "bold" : "normal"
        };
    }

    function showMissing() {
        setShowingType("missing");
    }
    function showingMissing() {
        return showingType == "missing"
    }
    function showingMissingLinkStyle() {
        return {
            cursor: "pointer",
            color: showingMissing() ? "black" : "blue",
            fontWeight: showingMissing() ? "bold" : "normal"
        };
    }

    let OnChangeEnv = (arg) => {
        environ = arg.target.value;
        let url = API.Url("/gac/" + environCompare, environ);
        const path = "/api/react/" + environ + "/gac/" + environCompare;
        navigate(path);
        fetchData(url, setData, setLoading, setError)
    }

    let OnChangeEnvCompare = (arg) => {
        environCompare = arg.target.value;
        let url = API.Url("/gac/" + environCompare, environ);
        const path = "/api/react/" + environ + "/gac/" + environCompare;
        navigate(path);
        fetchData(url, setData, setLoading, setError)
    }

    if (error) return <>Cannot load GAC comparison from Foursight: {error}</>;
    if (loading) return <>Loading content ...</>;

    let unique_keys = getUniqueKeys(data?.gac, data?.gac_compare);
    let unique_annotated_envs = info.envs?.unique_annotated;

    return <LoginAndValidEnvRequired>
            <b>&nbsp;GAC Comparison</b>:&nbsp;&nbsp;
            <small>
                { !showingRaw ? (<React.Fragment>
                <span style={showingAllLinkStyle()} onClick={() => showAll()}>ALL</span>&nbsp;|&nbsp;
                <span style={showingMatchesLinkStyle()} onClick={() => showMatches()}>MATCHES</span>&nbsp;|&nbsp;
                <span style={showingNonMatchesLinkStyle()} onClick={() => showNonMatches()}>NON-MATCHES</span>&nbsp;|&nbsp;
                <span style={showingDifferencesLinkStyle()} onClick={() => showDifferences()}>DIFFERENCES</span>&nbsp;|&nbsp;
                <span style={showingMissingLinkStyle()} onClick={() => showMissing()}>MISSING</span>
                </React.Fragment>):(<React.Fragment>
                </React.Fragment>)}
                <span style={{float:"right"}}>
                    <span style={{cursor:"pointer",color:showingRaw ? "black" : "blue",fontWeight:showingRaw ? "bold" : "normal"}} onClick={() => showRawData()}>RAW</span>&nbsp;|&nbsp;
                    <span style={{cursor:"pointer",color:showingRaw ? "blue" : "black",fontWeight:showingRaw ? "normal" : "bold"}} onClick={() =>showFormattedData()}>FORMATTED</span>&nbsp;
                </span>
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
                                { unique_annotated_envs?.map((env) =>
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
                                { unique_annotated_envs?.map((env) =>
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
                    { unique_keys?.map((key, keyIndex) => {
                        return <React.Fragment key={UUID()}>
                            { (showingAll() ||
                               (showingMatches() && sameGacValue(key, data)) ||
                               (showingNonMatches() && !sameGacValue(key, data)) ||
                               (showingDifferences() && !sameGacValue(key, data) && !(addedGacValue(key, data) || removedGacValue(key, data))) ||
                               (showingMissing() && (addedGacValue(key, data) || removedGacValue(key, data)))) ?
                            (<React.Fragment>
                            <tr key={UUID()} style={{color:sameGacValue(key, data) ? "inherit" : (removedGacValue(key, data) || addedGacValue(key, data) ? "red" : "darkred")}}>
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
                            </React.Fragment>):(<React.Fragment/>)}
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

export default GacComparePage;
