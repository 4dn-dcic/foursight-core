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
            const index = findSelectedGroupIndex(group)
            selectedGroups.splice(index, 1);
            setSelectedGroups((selectedGroups) => [...selectedGroups]);
        }
        else {
            setSelectedGroups((existingSelectedGroups) => [...existingSelectedGroups, group]);
        }
    }

    function selectGroup(group) {
        setSelectedGroups((existingSelectedGroups) => [...existingSelectedGroups, group]);
    }

    const ChecksGroupBox = ({}) => {
        return <div style={{minWidth:"150pt"}}>
            <div style={{fontWeight:"bold",paddingBottom:"3pt"}}>&nbsp;Groups</div>
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
            <div style={{fontWeight:"bold",paddingBottom:"3pt"}}>&nbsp;Selected Checks</div>
            { selectedGroups?.map(selectedGroup =>
                <SelectedGroupBox key={selectedGroup.group} group={selectedGroup} />
            )}
        </div>
    }

    const SelectedGroupBox = ({group}) => {
        return <div>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"400pt"}}>
                <b>{group?.group}</b>
                <br /> <br />
                { group.checks.map((check, index) => {
                    return <div key={index}>
                        <SelectedCheckBox check={check} index={index}/>
                    </div>
                })}
            </div>
        </div>
    }

    const SelectedCheckBox = ({check, index}) => {
        return <div>
            <table>
                <tbody>
                    <tr>
                        <td style={{verticalAlign:"top"}}>
                            <b>&#x2192;&nbsp;</b>
                        </td>
                        <td>
                            <u onClick={(arg) => {toggleCheckResultsBox(check, index)}}>{check.title}</u>
                            <br/>
                            { Object.keys(check?.schedule).map((key, index) => {
                                return <div key={index} title={check.schedule[key].cron}>
                    [[[{JSON.stringify(check)}]]]
                                    <i>Schedule: {check.schedule[key].cron_description}</i>
                                </div>
                            })}
                            <>
                                { isSelectedCheckResultsBoxShowing(check) && (
                                    <div style={{borderStyle:"solid",borderWidth:"1",padding:"10pt"}}>
                                        Put results here ...
                                        <SelectedCheckResultsBox check={check}/>
                                        <br/>
                                    </div>
                                )}
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
            {JSON.stringify(check.results)}
        </div>
    }


    function toggleCheckResultsBox(check, index) {
        if (check.showingResults) {
            hideCheckResultsBox(check, index);
        }
        else {
            showCheckResultsBox(check, index);
        }
    }

    function showCheckResultsBox(check, index) {
        const checkResultsUrl = API.Url(`/checks`, environ);
        fetchData(checkResultsUrl, checkResults => { check.results = checkResults;  setSelectedGroups([...selectedGroups]); }, setLoading, setError)
        check.showingResults = true;
    }
    function hideCheckResultsBox(check, index) {
        check.showingResults = false;
        setSelectedGroups((existingSelectedGroups) => [...existingSelectedGroups]);
    }
    function isSelectedCheckResultsBoxShowing(check) {
        console.log("isShowingCheckResultsBox");
        console.log(JSON.stringify(check))
        return check.showingResults;
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
