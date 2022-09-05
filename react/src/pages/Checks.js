import React from 'react';
import { useContext, useState, useEffect, useReducer } from 'react';
import { useParams } from 'react-router-dom';
import { Link, useNavigate } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { fetchData } from '../FetchUtils';
import { RingSpinner } from "../Spinners";
import { LoginAndValidEnvRequired } from "../LoginUtils";
import * as API from "../API";
import * as URL from "../URL";
let YAML = require('json-to-pretty-yaml');

const Checks = (props) => {

    let { environ } = useParams();
    const [ header ] = useContext(GlobalContext);
    let [ groupedChecks, setGroupedChecks ] = useState([]);
    let [ lambdas, setLambdas ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    let [ selectedGroups, setSelectedGroups ] = useState([])
    let [ checkResults, setCheckResults ] = useState([]);
    let [ showResultsDetailsFlag, setShowResultsDetailsFlag ] = useState([]);
    let [ selectedHistories, setSelectedHistories ] = useState([])

    useEffect(() => {
        const groupedChecksUrl = API.Url(`/checks/grouped`, environ);
        fetchData(groupedChecksUrl, groupedChecks => { setGroupedChecks(groupedChecks); setSelectedGroups([groupedChecks[0]])}, setLoading, setError)
        const lambdasUrl = API.Url(`/lambdas`, environ);
        fetchData(lambdasUrl, setLambdas);
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

    function onGroupSelect(group) {
        if (isSelectedGroup(group)) {
            const index = findSelectedGroupIndex(group);
            selectedGroups.splice(index, 1);
            setSelectedGroups((selectedGroups) => [...selectedGroups]);
        }
        else {
            setSelectedGroups((existingSelectedGroups) => [group, ...existingSelectedGroups]);
        }
    }

    function onGroupSelectAll(group) {
        if (isAllGroupsSelected()) {
            setSelectedGroups([groupedChecks[0]]);
        }
        else {
            setSelectedGroups([...groupedChecks]);
        }
    }

    function isAllGroupsSelected() {
        return groupedChecks.length == selectedGroups.length;
    }

    function selectGroup(group) {
        setSelectedGroups((existingSelectedGroups) => [...existingSelectedGroups, group]);
    }

    const ChecksGroupBox = ({}) => {
        return <div style={{minWidth:"150pt"}}>
            <div style={{fontWeight:"bold",paddingBottom:"3pt",cursor:"pointer"}} onClick={() => onGroupSelectAll()}>&nbsp;Check Groups</div>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                { groupedChecks.map((datum, index) => {
                    return <div key={datum.group}>
                        <span style={{fontWeight:isSelectedGroup(datum) ? "bold" : "normal",cursor:"pointer"}} onClick={() => onGroupSelect(datum)}>
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
                { lambdas.sort((a,b) => a.lambda_name > b.lambda_name ? 1 : (a.lambda_name < b.lambda_name ? -1 : 0)).map((datum, index) => {
                    return <div key={datum.lambda_name}>
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
        console.log(showingAnyGroupsResults)
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
            if (isShowingAnyResults(selectedGroups[i].checks)) {
                return true;
            }
        }
        return false;
    }

    function showAllGroupsResultsDetailsFlag() {
        setShowResultsDetailsFlag(true);
    }
    function hideAllGroupsResultsDetailsFlag() {
        setShowResultsDetailsFlag(false);
    }

    const SelectedGroupsPanel = ({}) => {
        return <div>
            { selectedGroups.length > 0 ? (<>
                <div style={{paddingBottom:"3pt"}}>
                    <span style={{cursor:"pointer"}} onClick={() => onClickSelectedGroupsTitle()}>
                        &nbsp;
                        <b>Checks</b>
                        { isShowingAnyGroupsResults() ? (<>
                            &nbsp;&#x2193;
                        </>):(<>
                            &nbsp;&#x2191;
                        </>)}
                    </span>
                    <small style={{float:"right"}}>
                        Results Details:&nbsp;
                        { showResultsDetailsFlag ? (<>
                            <span onClick={() => showAllGroupsResultsDetailsFlag()} style={{cursor:"pointer",fontWeight:"bold"}}>Show</span> |&nbsp;
                            <span onClick={() => hideAllGroupsResultsDetailsFlag()} style={{cursor:"pointer"}}>Hide</span>
                        </>):(<>
                            <span onClick={() => showAllGroupsResultsDetailsFlag()} style={{cursor:"pointer"}}>Show</span> |&nbsp;
                            <span onClick={() => hideAllGroupsResultsDetailsFlag()} style={{cursor:"pointer",fontWeight:"bold"}}>Hide</span>
                        </>)}
                        &nbsp;
                    </small>
                </div>
                { selectedGroups?.map(selectedGroup =>
                    <SelectedGroupBox key={selectedGroup.group} group={selectedGroup} />
                )}
            </>):(<></>)}
        </div>
    }

    const SelectedGroupBox = ({group}) => {
        return <div>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"430pt"}}>
                <b style={{cursor:"pointer"}} onClick={() => toggleShowAllResults(group.checks)}>{group?.group}</b> {isShowingAnyResults(group.checks) ? (<span>&#x2193;</span>) : (<span>&#x2191;</span>)}
                <br /> <br />
                { group.checks.map((check, index) => {
                    return <div key={index}>
                        <SelectedChecksBox check={check} index={index}/>
                    </div>
                })}
            </div>
        </div>
    }

    const SelectedChecksBox = ({check, index}) => {
        return <div>
            <table>
                <tbody>
                    <tr>
                        <td style={{verticalAlign:"top","cursor":"pointer"}} onClick={() => {toggleCheckResultsBox(check)}}>
                            <b>{ isShowingSelectedCheckResultsBox(check) ? <span>&#x2193;</span> : <span>&#x2192;</span> }&nbsp;</b>
                        </td>
                        <td>
                            <u style={{cursor:"pointer",fontWeight:isShowingSelectedCheckResultsBox(check) ? "bold" : "normal"}} onClick={() => {toggleCheckResultsBox(check)}}>{check.title}</u>
                            { isShowingSelectedCheckResultsBox(check) && check.results &&
                                (<span>&nbsp;&nbsp;<span style={{cursor:"pointer"}} onClick={() => {refreshResults(check)}}>&#8635;</span></span>)
                            }
                            <small>&nbsp;&nbsp;</small><span onClick={() => onClickShowResultsHistory(check)} style={{cursor:"pointer"}}><img src="https://cdn-icons-png.flaticon.com/512/32/32223.png" height="15"/></span>
                            <br/>
                            { Object.keys(check?.schedule).map((key, index) => {
                                return <div key={index} title={check.schedule[key].cron}>
                                    <small><i>Scheduled Run: {check.schedule[key].cron_description}</i></small>
                                </div>
                            })}
                            <>
                                { isShowingSelectedCheckResultsBox(check) && (<>
                                    <SelectedCheckResultsBox check={check}/>
                                </>)}
                                <br />
                            </>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    }

    const SelectedCheckResultsBox = ({check, index}) => {
        return <div>
            { check.results && <small>
                { Object.keys(check.results).length > 0 ? (<>
                    <div style={{height:"1px",marginTop:"2px",marginBottom:"2px",background:"darkgreen",}}></div>
                    <span>Latest Results: {check.results?.timestamp}</span> <br />
                    <span style={{color:check.results?.status?.toUpperCase() == "PASS" ? "darkgreen" : "red"}}>Results Summary: {check.results?.summary}</span>&nbsp;&nbsp;
                    { check.results?.status?.toUpperCase() == "PASS" ? (<b style={{fontSize:"12pt",color:"darkgreen"}}>&#x2713;</b>) : (<b style={{fontSize:"13pt",color:"red"}}>&#x2717;</b>)}
                </>):(<>
                    { !showResultsDetailsFlag && <span>No results.</span> }
                </>)}
            </small> }
            { showResultsDetailsFlag ? (
                <pre className="check-pass" style={{filter:"brightness(1.08)",borderColor:"green",borderWidth:"2",wordWrap: "break-word",marginTop:"3px",marginRight:"5pt",maxWidth:"600pt"}}>
                    {!check.results ? <i>Loading ...</i> : (Object.keys(check.results).length > 0 ? YAML.stringify(check.results) : "No results.") }
                </pre>
            ):(
                <span>
                    <div style={{height:"1px",marginTop:"2px",marginBottom:"2px",background:"darkgreen",}}></div>
                    {!check.results ? <small><i>Loading ...</i></small> : <></>}
                </span>
            )}
        </div>
    }

    const ResultsHistoryBox = ({check}) => {
        return <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
            History Box: {check.name}
            {check.showingHistory && JSON.stringify(check.history)}
        </div>
    }

    const ResultsHistoryPanel = ({}) => {
        let histories = selectedHistories?.filter((check) => check.showingHistory);
        if (histories.length <= 0) {
            return <span>foo</span>
        }
        return <div>
            <b style={{marginBottom:"100pt"}}>Results Histories</b>
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

    function noteChangeHistories() {
    }
    function showResultsHistory(check) {
        if (!check.showingHistory) {
            check.showingHistory = true;
            selectedHistories.unshift(check);
            setSelectedHistories([...selectedHistories]);
            if (!check.history) {
                const resultsHistoryUrl = API.Url(`/checks/${check.name}/history`, environ);
                fetchData(resultsHistoryUrl, resultsHistory => { check.history = resultsHistory; setSelectedHistories((x) => [...x]);});
                //fetchData(resultsHistoryUrl, resultsHistory => { check.history = resultsHistory; setSelectedHistories([...selectedHistories]);});
            }
        }
    }

    function hideResultsHistory(check) {
        if (check.showingHistory) {
            check.showingHistory = false;
            const index = findResultsHistoryIndex(check);
            selectedHistories.splice(index, 1);
            setSelectedHistories([...selectedHistories]);
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
        for (let i = 0 ; i < checks.length ; i++) {
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
        setSelectedGroups([...selectedGroups]);
        if (!check.results) {
            const checkResultsUrl = API.Url(`/checks/${check.name}`, environ);
            fetchData(checkResultsUrl, checkResults => { check.results = checkResults; setSelectedGroups([...selectedGroups]); }, setLoading, setError)
        }
    }

    function hideCheckResultsBox(check) {
        check.showingResults = false;
        setSelectedGroups((existingSelectedGroups) => [...existingSelectedGroups]);
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
