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
    const [ groupedChecks, setGroupedChecks ] = useState([]);
    const [ lambdas, setLambdas ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    let [ selectedGroups, setSelectedGroups ] = useState([])
        const [ checkResults, setCheckResults ] = useState([]);

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

    const SelectedGroupsBox = ({}) => {
        return <div>
            <div style={{fontWeight:"bold",paddingBottom:"3pt",cursor:"pointer"}} onClick={() => {selectedGroups?.map(selectedGroup => toggleShowAllResults(selectedGroup.checks))}}>&nbsp;Checks</div>
            { selectedGroups?.map(selectedGroup =>
                <SelectedGroupBox key={selectedGroup.group} group={selectedGroup} />
            )}
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
                        <td style={{verticalAlign:"top","cursor":"pointer"}} onClick={(arg) => {toggleCheckResultsBox(check)}}>
                            <b>{ isShowingSelectedCheckResultsBox(check) ? <span>&#x2193;</span> : <span>&#x2192;</span> }&nbsp;</b>
                        </td>
                        <td>
                            <u style={{cursor:"pointer",fontWeight:isShowingSelectedCheckResultsBox(check) ? "bold" : "normal"}} onClick={(arg) => {toggleCheckResultsBox(check)}}>{check.title}</u>
                            { isShowingSelectedCheckResultsBox(check) && check.results && (<span>&nbsp;<span style={{cursor:"pointer"}} onClick={() => {refreshResults(check)}}>&#8635;</span></span>) }
                            <br/>
                            { Object.keys(check?.schedule).map((key, index) => {
                                return <div key={index} title={check.schedule[key].cron}>
                                    <i>Scheduled Run: {check.schedule[key].cron_description}</i>
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
            Latest Results: {check.results?.timestamp}
            <pre className="check-pass" style={{filter:"brightness(1.08)",borderColor:"green",borderWidth:"2",wordWrap: "break-word",marginTop:"3px",marginRight:"5pt",maxWidth:"600pt"}}>
                {!check.results ? "Loading ..." : (Object.keys(check.results).length > 0 ? YAML.stringify(check.results) : "No results.") }
            </pre>
        </div>
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
                console.log('hidall')
            hideAllResults(checks);
        }
        else {
            showAllResults(checks);
        }
    }

    function isShowingAnyResults(checks) {
            console.log('xxx')
        for (let i = 0 ; i < checks.length ; i++) {
            if (checks[i].showingResults) {
            console.log('true')
                return true;
            }
        }
            console.log('false')
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
        // check.results = null;
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
                        <SelectedGroupsBox />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </LoginAndValidEnvRequired>
};

export default Checks;
