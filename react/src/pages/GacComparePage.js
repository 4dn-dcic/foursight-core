import React from 'react';
import { useContext, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Uuid from 'react-uuid';
import { useFetch } from '../utils/Fetch';
import Char from '../utils/Char';
import Env from '../utils/Env';
import HeaderData from '../HeaderData';
import Server from '../utils/Server';
import Yaml from '../utils/Yaml';

const GacComparePage = (props) => {

    const [ header ] = useContext(HeaderData);
    const { environCompare } = useParams();
    const [ showingRaw, setShowingRaw ] = useState(false);
    const [ showingType, setShowingType ] = useState("all");
    const response = useFetch(Server.Url(`/gac/${environCompare}`, Env.Current()))
    const navigate = useNavigate();

    function getUniqueKeys(gac, gac_compare) {
        let uniqueKeys = [];
        if (!gac || !gac_compare) {
            return uniqueKeys;
        }
        Object.keys(gac)?.forEach((key) => {
            if (!uniqueKeys.includes(key)) {
                uniqueKeys.push(key);
            }
        });
        Object.keys(gac_compare)?.forEach((key) => {
            if (!uniqueKeys.includes(key)) {
                uniqueKeys.push(key);
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
        return gac ? gac["ENCODED_IDENTITY"] : "";
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
        return showingType === "all"
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
        return showingType === "matches"
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
        return showingType === "nonmatches"
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
        return showingType === "differences"
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
        return showingType === "missing"
    }
    function showingMissingLinkStyle() {
        return {
            cursor: "pointer",
            color: showingMissing() ? "black" : "blue",
            fontWeight: showingMissing() ? "bold" : "normal"
        };
    }

    let OnChangeEnv = (arg) => {
        const environ = arg.target.value;
        let url = Server.Url("/gac/" + environCompare, environ);
        const path = "/api/react/" + environ + "/gac/" + environCompare;
        navigate(path);
     // Fetch.get(url, setData, setLoading, setError)
        response.refresh({ url: url });
    }

    let OnChangeEnvCompare = (arg) => {
        const environCompare = arg.target.value;
        let url = Server.Url("/gac/" + environCompare, Env.Current());
        const path = "/api/react/" + Env.Current() + "/gac/" + environCompare;
        navigate(path);
     // Fetch.get(url, setData, setLoading, setError)
        response.refresh({ url: url });
    }

    if (response.error) return <>Cannot load GAC comparison from Foursight: {response.error}</>;
    if (response.loading) return <>Loading content ...</>;

    let unique_keys = getUniqueKeys(response.get("gac"), response.get("gac_compare"));
    let knownEnvs = Env.KnownEnvs();

    return <>
        <div style={{width:"fit-content"}}>
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
                            <select defaultValue={Env.PreferredName(Env.Current(), header)} style={{border:"0",fontWeight:"normal",fontStyle:"italic",color:"blue",background:"transparent","WebkitAppearance":"none"}} onChange={(arg) => OnChangeEnv(arg)}>
                                { knownEnvs.map((env) =>
                                    Env.PreferredName(env, header) === Env.PreferredName(Env.Current(), header) ?
                                        <option key={Env.PreferredName(env, header)}>{Env.PreferredName(env, header)}</option> :
                                        <option key={Env.PreferredName(env, header)}>{Env.PreferredName(env, header)}</option>
                                )}
                            </select>&nbsp;<span style={{color:"blue"}}>{Char.DownArrow}</span>
                            <br />
                            {getGacName(response.get("gac"))}
                        </td>
                        <td>
                            <select defaultValue={environCompare} style={{border:"0",fontWeight:"normal",fontStyle:"italic",color:"blue",background:"transparent","WebkitAppearance":"none"}} onChange={(arg) => OnChangeEnvCompare(arg)}>
                                { knownEnvs.map((env) =>
                                    Env.PreferredName(env, header) === environCompare ?
                                        <option key={Env.PreferredName(env, header)}>{Env.PreferredName(env, header)}</option> :
                                        <option key={Env.PreferredName(env, header)}>{Env.PreferredName(env, header)}</option>
                                )}
                            </select>&nbsp;<span style={{color:"blue"}}>{Char.DownArrow}</span>
                            <br />
                            {getGacName(response.get("gac_compare"))}
                        </td>
                    </tr>
                    <tr><td style={{height:"3px"}} colSpan="4"></td></tr>
                    <tr><td style={{height:"1px",background:"darkblue"}} colSpan="4"></td></tr>
                    <tr><td style={{height:"8px"}} colSpan="4"></td></tr>
                    </thead>
                    <tbody style={{fontSize:"10pt"}}>
                    { unique_keys?.map((key, keyIndex) => {
                        return <React.Fragment key={Uuid()}>
                            { (showingAll() ||
                               (showingMatches() && sameGacValue(key, response.data)) ||
                               (showingNonMatches() && !sameGacValue(key, response.data)) ||
                               (showingDifferences() && !sameGacValue(key, response.data) && !(addedGacValue(key, response.data) || removedGacValue(key, response.data))) ||
                               (showingMissing() && (addedGacValue(key, response.data) || removedGacValue(key, response.data)))) ?
                            (<React.Fragment>
                            <tr key={Uuid()} style={{color:sameGacValue(key, response.data) ? "inherit" : (removedGacValue(key, response.data) || addedGacValue(key, response.data) ? "red" : "darkred")}}>
                            <td>
                                {sameGacValue(key, response.data) ? <span>{Char.Check}</span> : <span>{Char.X}</span>}&nbsp;
                            </td>
                            <td>
                                <b>{key}</b>
                            </td>
                            <td style={{paddingRight:"8pt"}}>
                                <span>{addedGacValue(key, response.data) ? <b>MISSING</b> : ((appearsToBeObfuscated(response.data.gac[key]) ? <b>OBFUSCATED</b> : response.data.gac[key]) || <b>{Char.EmptySet}</b>)}</span>
                            </td>
                            <td>
                                <span>{removedGacValue(key, response.data) ? <b>MISSING</b> : ((appearsToBeObfuscated(response.data.gac_compare[key]) ? <b>OBFUSCATED</b> : response.data.gac_compare[key]) || <b>{Char.EmptySet}</b>)}</span>
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
                {response.yaml()}
            </pre>
        </div>
    </>
};

export default GacComparePage;
