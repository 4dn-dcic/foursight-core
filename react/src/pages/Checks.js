import React from 'react';
import { useContext, useState, useEffect, useReducer } from 'react';
import { useParams } from 'react-router-dom';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { fetchData } from '../FetchUtils';
import { BarSpinner } from "../Spinners";
import { LoginAndValidEnvRequired } from "../LoginUtils";
import * as API from "../API";
import * as URL from "../URL";
import { isObject } from '../Utils';
import { UUID } from '../Utils';
let YAML = require('json-to-pretty-yaml');

const Checks = (props) => {

    let { environ } = useParams();
    const [ header ] = useContext(GlobalContext);
    let [ groupedChecks, setGroupedChecks ] = useState([]);
    let [ lambdas, setLambdas ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    let [ selectedGroups, setSelectedGroups ] = useState([])
    let [ selectedHistories, setSelectedHistories ] = useState([])

    useEffect(() => {
        const groupedChecksUrl = API.Url(`/checks`, environ);
        fetchData(groupedChecksUrl, groupedChecks => {
            setGroupedChecks(groupedChecks.sort((a,b) => a.group > b.group ? 1 : (a.group < b.group ? -1 : 0)));
            if (groupedChecks.length > 0) {
                showGroup(groupedChecks[0]);
            }
        }, setLoading, setError);
        const lambdasUrl = API.Url(`/lambdas`, environ);
        fetchData(lambdasUrl, lambdas => {
            setLambdas(lambdas.sort((a,b) => a.lambda_name > b.lambda_name ? 1 : (a.lambda_name < b.lambda_name ? -1 : 0)));
        });
    }, []);

    function isSelectedGroup(group) {
        for (let i = 0 ; i < selectedGroups?.length ; i++) {
            const selectedGroup = selectedGroups[i]
            if (selectedGroup.group == group.group) {
                return true;
            }
        }
        return false;
    }

    function findSelectedGroupIndex(group) {
        for (let i = 0 ; i < selectedGroups.length ; i++) {
            const selectedGroup = selectedGroups[i]
            if (selectedGroup.group == group.group) {
                return i;
            }
        }
        return -1;
    }

    function noteChangedSelectedGroups() {
        setSelectedGroups(existing => [...existing]);
    }

    function noteChangedResults() {
        setSelectedGroups(existing => [...existing]);
    }

    function noteChangedHistories() {
        setSelectedHistories(existing => [...existing]);
    }

    function showGroup(group, showResults = true) {
        if (isSelectedGroup(group)) {
            const index = findSelectedGroupIndex(group);
            selectedGroups.splice(index, 1);
            noteChangedResults();
        }
        else {
            selectedGroups.unshift(group)
            noteChangedResults()
            if (showResults) {
                group.checks.map(check => showCheckResultsBox(check));
            }
        }
    }

    function onGroupSelectAll(group) {
        if (groupedChecks.length == selectedGroups.length) {
            setSelectedGroups([groupedChecks[0]]);
        }
        else {
            setSelectedGroups([...groupedChecks]);
        }
    }

    const ChecksGroupBox = ({}) => {
        return <div style={{minWidth:"150pt"}}>
            <div style={{fontWeight:"bold",paddingBottom:"3pt",cursor:"pointer"}} onClick={() => onGroupSelectAll()}>&nbsp;Check Groups</div>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                { groupedChecks.map((datum, index) => {
                    return <div key={datum.group}>
                        <span style={{fontWeight:isSelectedGroup(datum) ? "bold" : "normal",cursor:"pointer"}} onClick={() => showGroup(datum)}>
                            {datum.group}
                        </span>
                        { index < groupedChecks.length - 1 &&
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"darkgreen"}} />
                        }
                    </div>
                })}
            </div>
        </div>
    }

    const LambdasBox = ({}) => {
        return <div>
            <div style={{fontWeight:"bold",paddingBottom:"3pt"}}>&nbsp;Lambdas</div>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                { lambdas.map((datum, index) => {
                    return <div key={datum.lambda_name} title={datum.lambda_function_name}>
                        {datum.lambda_name}
                        { index < lambdas.length - 1 &&
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"darkgreen"}} />
                        }
                    </div>
                })}
            </div>
        </div>
    }

    function onClickSelectedGroupsTitle(checks) {
        const showingAnyGroupsResults = isShowingAnyGroupsResults();
        for (let i = 0 ; i < selectedGroups.length ; i++) {
            if (showingAnyGroupsResults) {
                hideAllResults(selectedGroups[i].checks);
            }
            else {
                showAllResults(selectedGroups[i].checks);
            }
        }
    }

    function isShowingAnyGroupsResults() {
        for (let i = 0 ; i < selectedGroups.length ; i++) {
            if (isShowingAnyResults(selectedGroups[i]?.checks)) {
                return true;
            }
        }
        return false;
    }

    function isShowingAnyResultDetails() {
        for (let i = 0 ; i < selectedGroups?.length ; i++) {
            for (let j = 0 ; j < selectedGroups[i]?.checks?.length ; j++) {
                if (selectedGroups[i].checks[j].showingResultDetails) {
                    return true;
                }
            }
        }
        return false;
    }

    function isShowingAllResultDetails() {
        for (let i = 0 ; i < selectedGroups?.length ; i++) {
            for (let j = 0 ; j < selectedGroups[i]?.checks?.length ; j++) {
                if (!selectedGroups[i].checks[j].showingResultDetails) {
                    return false;
                }
            }
        }
        return true;
    }

    function showAllResultDetails() {
        selectedGroups?.map(group => group.checks.map(check => check.showingResultDetails = true));
        noteChangedResults();
    }

    function hideAllResultDetails() {
        selectedGroups?.map(group => group.checks.map(check => check.showingResultDetails = false));
        noteChangedResults();
    }

    const SelectedGroupsPanel = ({}) => {
        return <div>
            { selectedGroups.length > 0 ? (<>
                <div style={{paddingBottom:"3pt"}}>
                    <span style={{cursor:"pointer"}} onClick={() => onClickSelectedGroupsTitle()}>
                        &nbsp;
                        <b>Check Details</b>
                        { isShowingAnyGroupsResults() ? (<>
                            &nbsp;&#x2193;
                        </>):(<>
                            &nbsp;&#x2191;
                        </>)}
                    </span>
                    <span style={{float:"right",fontSize:"x-small",marginTop:"6px",color:"darkgreen"}}>
                        All Results Details:&nbsp;
                        { isShowingAllResultDetails() ? (<>
                            <span style={{fontWeight:"bold"}}>Show</span>
                        </>):(<>
                            <span onClick={() => showAllResultDetails()} style={{cursor:"pointer"}}>Show</span>
                        </>)}
                        &nbsp;|&nbsp;
                        { isShowingAnyResultDetails() ? (<>
                            <span onClick={() => hideAllResultDetails()} style={{cursor:"pointer"}}>Hide</span>
                        </>):(<>
                            <span style={{fontWeight:"bold"}}>Hide</span>
                        </>)}
                        &nbsp;
                    </span>
                </div>
                { selectedGroups?.map((selectedGroup, index) =>
                    <SelectedGroupBox key={index} group={selectedGroup} />
                )}
            </>):(<></>)}
        </div>
    }

    const SelectedGroupBox = ({group}) => {
        return <div>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"430pt"}}>
                <div>
                    <b style={{cursor:"pointer"}} onClick={() => toggleShowAllResults(group?.checks)}>{group?.group}</b> {isShowingAnyResults(group?.checks) ? (<span>&#x2193;</span>) : (<span>&#x2191;</span>)}
                    <span style={{float:"right",cursor:"pointer"}} onClick={(() => {showGroup(group)})}><b>&#x2717;</b></span>
                </div>
                <div style={{marginTop:"6pt"}} />
                { group?.checks?.map((check, index) => {
                    return <div key={index}>
                        <SelectedChecksBox check={check} index={index}/>
                    </div>
                })}
            </div>
        </div>
    }

    const SelectedChecksBox = ({check, index}) => {
        return <div>
            <table style={{width:"100%"}}>
                <tbody>
                    <tr style={{height:"3pt"}}><td></td></tr>
                    <tr>
                        <td style={{verticalAlign:"top",width:"1%","cursor":"pointer"}} onClick={() => {toggleCheckResultsBox(check)}}>
                            <b>{ isShowingSelectedCheckResultsBox(check) ? <span>&#x2193;</span> : <span>&#x2192;</span> }&nbsp;</b>
                        </td>
                        <td style={{veriticalAlign:"top"}}>
                            <u style={{cursor:"pointer",fontWeight:isShowingSelectedCheckResultsBox(check) ? "bold" : "normal"}} onClick={() => {toggleCheckResultsBox(check)}}>{check.title}</u>
                            { isShowingSelectedCheckResultsBox(check) && check.results &&
                                (<span>&nbsp;&nbsp;<span style={{cursor:"pointer",fontSize:"large"}} onClick={() => {refreshResults(check)}}>&#8635;</span></span>)
                            }
                                <small>&nbsp;&nbsp;</small>
                                <span onClick={() => onClickShowResultsHistory(check)} style={{paddingTop:"10px",cursor:"pointer"}}>
                                    <img src="https://cdn-icons-png.flaticon.com/512/32/32223.png" style={{paddingBottom:"4px",height:"22"}}/>
                                    {check.showingHistory ? <span style={{paddingTop:"10px"}}>&#x2192;</span> : <></>}
                                </span>
                            { Object.keys(check?.schedule).map((key, index) => {
                                return <div key={index} title={check.schedule[key].cron}>
                                    <small><i>Scheduled Run: {check.schedule[key].cron_description}</i></small>
                                </div>
                            })}
                            <>
                                { isShowingSelectedCheckResultsBox(check) && (<>
                                    <SelectedCheckResultsBox check={check}/>
                                </>)}
                            </>
                        </td>
                    </tr>
                    <tr style={{height:"3pt"}}><td></td></tr>
                </tbody>
            </table>
        </div>
    }

    const SelectedCheckResultsBox = ({check, index}) => {
        return <div>
            { check.results && <small>
                { Object.keys(check.results).length > 0 ? (<>
                    <div style={{height:"1px",marginTop:"2px",marginBottom:"2px",background:"gray"}}></div>
                    <span>Latest Results: {check.results?.timestamp}</span>
                        { check.showingResultDetails ? (
                            <b style={{cursor:"pointer"}} onClick={() => { check.showingResultDetails = false; noteChangedResults(); }}>&nbsp;&#x2193;</b>
                        ):(
                            <b style={{cursor:"pointer"}} onClick={() => { check.showingResultDetails = true; noteChangedResults(); }}>&nbsp;&#x2191;</b>
                        )}
                    <br />
                    <span style={{color:check.results?.status?.toUpperCase() == "PASS" ? "darkgreen" : "red"}}>Results Summary: {check.results?.summary}</span>&nbsp;&nbsp;
                    { check.results?.status?.toUpperCase() == "PASS" ? (<b style={{fontSize:"12pt",color:"darkgreen"}}>&#x2713;</b>) : (<b style={{fontSize:"13pt",color:"red"}}>&#x2717;</b>)}
                </>):(<>
                    { !check.showingResultDetails && <span>No results.</span> }
                </>)}
            </small> }
            { check.showingResultDetails ? (
                <pre className="check-pass" style={{filter:"brightness(1.08)",borderColor:"green",borderWidth:"2",wordWrap: "break-word",marginTop:"3px",marginRight:"5pt",maxWidth:"600pt"}}>
                    {!check.results ? <Spinner condition={!check.results} label={"Loading results"} color={"darkgreen"}/> : (Object.keys(check.results).length > 0 ? YAML.stringify(check.results) : "No results.") }
                </pre>
            ):(
                <span>
                    <div style={{height:"1px",marginTop:"2px",marginBottom:"2px",background:"gray"}}></div>
                    { !check.results && <Spinner condition={!check.results} label={"Loading results"} color={"darkgreen"}/> }
                </span>
            )}
        </div>
    }

    const Spinner = ({condition, color = "darkblue", size = 100, label = "Loading"}) => {
        return <table><tbody><tr>
            {label && <td nowrap="1"><small><i>{label}</i></small>&nbsp;&nbsp;</td>}
            <td style={{paddingTop:"5px"}} nowrap="1"> <BarSpinner condition={true} size={size} color={color} /></td>
        </tr></tbody></table>
    }

    const ResultsHistoryBox = ({check}) => {

        function extractUUID(history) {
            return history[2].uuid;
        }
        function extractStatus(history) {
            return history[0];
        }
        function extractTimestamp(history) {
            return history[2].timestamp;
        }
        function extractDuration(history) {
            return history[2].runtime_seconds;
        }
        function extractDescription(history) {
            return history[1];
        }
        function extractState(history) {
            return history[2].queue_action;
        }

        return <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
            <div title={check.name}>
                <b>{check.title}</b>&nbsp;
                { check.history && <span>&nbsp;&nbsp;<span style={{cursor:"pointer",fontSize:"large"}} onClick={() => {refreshHistory(check)}}>&#8635;&nbsp;&nbsp;</span></span> }
                <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideResultsHistory(check)})}><b>&#x2717;</b></span>
            </div>
            <div style={{marginBottom:"6pt"}}/>
            { check.showingHistory && (<>
                { check.history?.history?.length > 0 ? (<>
                    <table style={{width:"100%"}}>
                    <thead>
                        <tr>
                            <td>
                                &#x2630;
                            &nbsp;&nbsp;</td>
                            <td>
                                Timestamp
                            &nbsp;&nbsp;</td>
                            <td>
                                Status
                            &nbsp;&nbsp;</td>
                            <td style={{textAlign:"right"}}>
                                Duration
                            &nbsp;</td>
                            <td>
                                State
                            &nbsp;</td>
                        </tr>
                        <tr><td style={{height:"1px",background:"gray"}} colSpan="5"></td></tr>
                        <tr><td style={{paddingTop:"4px"}}></td></tr>
                    </thead>
                    <tbody>
                    {check.history.history.map((history, index) => {
                        return <React.Fragment key={extractUUID(history)}>
                            { index != 0 && (<>
                                <tr><td style={{paddingTop:"2px"}}></td></tr>
                                <tr><td style={{height:"1px",background:"gray"}} colSpan="5"></td></tr>
                                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            </>)}
                            <tr>
                            <td>
                                {extractStatus(history) == "PASS" ? (<>
                                    <span style={{color:"darkgreen"}}>&#x2713;</span>
                                </>):(<>
                                    <span style={{color:"darkred"}}>&#x2717;</span>
                                </>)}
                            &nbsp;&nbsp;</td>
                            <td>
                                {extractTimestamp(history)}
                            &nbsp;&nbsp;</td>
                            <td>
                                {extractStatus(history) == "PASS" ? (<>
                                    <b style={{color:"darkgreen"}}>OK</b>
                                </>):(<>
                                    <b style={{color:"darkred"}}>ERROR</b>
                                </>)}
                            &nbsp;&nbsp;</td>
                            <td style={{textAlign:"right"}}>
                                {extractDuration(history)}
                            &nbsp;&nbsp;</td>
                            <td style={{textAlign:"right"}}>
                                {extractState(history)}
                            &nbsp;&nbsp;</td>
                            </tr>
                        </React.Fragment>
                    })}
                    </tbody>
                    </table>
                </>):(<>
                    { check.history ? (<>
                        <span style={{color:"black"}}>No history.</span>
                    </>):(<>
                        <Spinner condition={!check.results} color={"darkgreen"} label="Loading history" />
                    </>)}
                </>)}
            </>)}
        </div>
    }

    const ResultsHistoryPanel = ({}) => {
        let histories = selectedHistories?.filter((check) => check.showingHistory);
        if (histories.length <= 0) {
            return <span />
        }
        return <div>
            <b style={{marginBottom:"100pt"}}>Recent Results Histories</b>
            { histories.map((selectedHistory, index) => {
                return <div key={index} style={{marginTop:"3pt"}}>
                    <ResultsHistoryBox check={selectedHistory} />
                </div>
            })}
        </div>
    }

    function onClickShowResultsHistory(check) {
        toggleResultsHistory(check);
    }

    function toggleResultsHistory(check) {
        if (check.showingHistory) {
            hideResultsHistory(check);
        }
        else {
            showResultsHistory(check);
        }
    }

    function showResultsHistory(check) {
        if (!check.showingHistory) {
            check.showingHistory = true;
            selectedHistories.unshift(check);
            noteChangedHistories();
            if (!check.history) {
                const resultsHistoryUrl = API.Url(`/checks/${check.name}/history`, environ);
                fetchData(resultsHistoryUrl, history => { check.history = history; noteChangedHistories(); });
            }
        }
    }

    function hideResultsHistory(check) {
        if (check.showingHistory) {
            check.showingHistory = false;
            const index = findResultsHistoryIndex(check);
            selectedHistories.splice(index, 1);
            noteChangedHistories();
        }
    }

    function findResultsHistoryIndex(check) {
        for (let i = 0 ; i < selectedHistories.length ; i++) {
            const selectedHistory = selectedHistories[i]
            if (selectedHistory.name == check.name) {
                return i;
            }
        }
        return -1;
    }

    function refreshResults(check) {
        check.results = null;
        if (check.showingResults) {
            hideCheckResultsBox(check);
            showCheckResultsBox(check);
        }
    }

    function refreshHistory(check) {
        check.history = null;
        if (check.showingHistory) {
            hideResultsHistory(check);
            showResultsHistory(check);
        }
    }

    function toggleCheckResultsBox(check) {
        if (check.showingResults) {
            hideCheckResultsBox(check);
        }
        else {
            showCheckResultsBox(check);
        }
    }

    function toggleShowAllResults(checks) {
        if (isShowingAnyResults(checks)) {
            hideAllResults(checks);
        }
        else {
            showAllResults(checks);
        }
    }

    function isShowingAnyResults(checks) {
        for (let i = 0 ; i < checks?.length ; i++) {
            if (checks[i].showingResults) {
                return true;
            }
        }
        return false;
    }

    function showAllResults(checks) {
        checks.map((check) => !check.showingResults && showCheckResultsBox(check));
    }

    function hideAllResults(checks) {
        checks.map((check) => check.showingResults && hideCheckResultsBox(check));
    }

    function showCheckResultsBox(check) {
        check.showingResults = true;
        noteChangedSelectedGroups();
        if (!check.results) {
            const checkResultsUrl = API.Url(`/checks/${check.name}`, environ);
            fetchData(checkResultsUrl, checkResults => { check.results = checkResults; noteChangedResults(); }, setLoading, setError)
        }
    }

    function hideCheckResultsBox(check) {
        check.showingResults = false;
        noteChangedSelectedGroups();
    }
    function isShowingSelectedCheckResultsBox(check) {
        return check?.showingResults;
    }

    return <LoginAndValidEnvRequired>
        <div>
            <table><tbody>
                <tr>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <ChecksGroupBox />
                        <LambdasBox />
                    </td>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <SelectedGroupsPanel />
                    </td>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <ResultsHistoryPanel />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </LoginAndValidEnvRequired>
};

export default Checks;
