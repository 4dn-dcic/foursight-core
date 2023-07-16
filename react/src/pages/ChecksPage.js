import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Uuid from 'react-uuid';
import { RingSpinner, PuffSpinnerInline, StandardSpinner } from '../Spinners';
//import { useReadOnlyMode } from '../ReadOnlyMode';
import useReadOnlyMode from '../hooks/ReadOnlyMode';
import useFetch from '../hooks/Fetch';
import useFetchFunction from '../hooks/FetchFunction';
import { FetchErrorBox } from '../Components';
import Char from '../utils/Char';
import Clipboard from '../utils/Clipboard';
import Client from '../utils/Client';
import ChecksValidation from '../components/ChecksValidation';
import Date from '../utils/Date';
import DateTime from '../utils/DateTime';
import DisplayStatusText from '../components/DisplayStatusText';
import Duration from '../utils/Duration';
import Env from '../utils/Env';
import Image from '../utils/Image';
import Json from '../utils/Json';
import Server from '../utils/Server';
import Str from '../utils/Str';
import TableHead from '../TableHead';
import Time from '../utils/Time';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';
import Styles from '../Styles';
import Tooltip from '../components/Tooltip';

function noteChangedSelectedGroups(groupList) {
    groupList.update();
}

function noteChangedResults(groupList) {
    groupList.update();
}

function noteChangedCheckBox(groupList) {
    groupList.update();
}

function hideResultBox(check, groupList) {
    check.__showingResults = false;
    noteChangedSelectedGroups(groupList);
}

function showResultBox(check, env, groupList) {
    check.__showingResults = true;
    noteChangedSelectedGroups(groupList);
}

function showGroup(group, env, groupList) {
    if (isSelectedGroup(group, groupList)) {
        return;
    }
    groupList.prepend(group);
    noteChangedSelectedGroups(groupList);
}

function hideGroup(group, groupList, historyList) {
    group.checks.map(check => hideHistory(check, historyList));
    const index = findSelectedGroupIndex(group, groupList);
    groupList.remove(index);
}

function isSelectedGroup(group, groupList) {
    for (let i = 0 ; i < groupList.length ; i++) {
        const selectedGroup = groupList.get(i);
        if (selectedGroup.group === group.group) {
            return true;
        }
    }
    return false;
}

function findSelectedGroupIndex(group, groupList) {
    for (let i = 0 ; i < groupList.length ; i++) {
        const selectedGroup = groupList.get(i);
        if (selectedGroup.group === group.group) {
            return i;
        }
    }
    return -1;
}

function isShowingSelectedCheckResultsBox(check) {
    return check?.__showingResults;
}

function saveInputKwargs(check) {
    Object.keys(check.kwargs).forEach(key => {
        if (!Type.IsBoolean(check.kwargs[key]) && !Type.IsNonEmptyArray(check.kwargs[key])) {
            const inputId = `${check.name}.${key}`;
            const inputElement = document.getElementById(inputId);
            const inputValue = inputElement?.value;
            check.kwargs[key] = inputValue;
        }
    });
}

function hideHistory(check, historyList) {
    if (check.__showingHistory) {
        check.__showingHistory = false;
        const index = findResultsHistoryIndex(check, historyList);
        historyList.remove(index);
    }
}

function findResultsHistoryIndex(check, historyList) {
    for (let i = 0 ; i < historyList.length ; i++) {
        const selectedHistory = historyList.get(i)
        if (selectedHistory.name === check.name) {
            return i;
        }
    }
    return -1;
}

function onClickShowHistory(check, env, historyList) {
    toggleResultsHistory(check, env, historyList);
}

function toggleResultsHistory(check, env, historyList) {
    if (check.__showingHistory) {
        hideHistory(check, historyList);
    }
    else {
        showHistory(check, env, historyList);
    }
}

function showHistory(check, env, historyList) {
    if (!check.__showingHistory) {
        check.__showingHistory = true;
        historyList.prepend(check);
    }
}

function doRunCheck(check, env, groupList, historyList, fetch) {
    const args = check.kwargs;
    const argsString = Json.Str(args);
    const argsEncoded = btoa(argsString);
    hideCheckRunningBox(check, groupList);
    noteChangedCheckBox(groupList);
    check.__queueingCheckRun = true;
    fetch({
        url: Server.Url(`/checks/${check.name}/run?args=${argsEncoded}`, env),
        onData: (data) => {
            //
            // The only thing we need/want from this is the UUID identifying the check run.
            //
            check.__queueingCheckRun = false;
            check.__queuedCheckRun = data.uuid;
            //
            // For user convenience do what they plausably would do anyways: refresh the history,
            // a few (4) seconds after this check run completes (here).
            //
            setTimeout(() => {
                refreshHistory(check);
                noteChangedCheckBox(groupList);
            }, 4 * 1000);
            return data.uuid;
        }
    });
    check.__queuedCheckRun = null;
    showCheckRunningBox(check, groupList);
    showHistory(check, env, historyList);
}

function doRunAction(check, action, env, groupList, fetch) {
    const args = { check_name: check.name, called_by: check.__result?.get("uuid") }
    const argsString = Json.Str(args);
    const argsEncoded = btoa(argsString);
    hideActionRunningBox(check, groupList);
    noteChangedCheckBox(groupList);
    check.__queueingActionRun = true;
    fetch({
        url: Server.Url(`/action/${action}/run?args=${argsEncoded}`, env),
        onData: (data) => {
            //
            // The only thing we need/want from this is the UUID identifying the action run.
            //
            check.__queueingActionRun = false;
            check.__queuedActionRun = data.uuid;
            return data.uuid;
        }
    });
    check.__queuedActionRun = null;
    showActionRunningBox(check, groupList);
}

function refreshHistory(check) {
    if (check.__resultHistory) {
        check.__resultHistory.refresh();
    }
}

function showCheckRunningBox(check, groupList) {
    check.showingCheckRunningBox = true;
    noteChangedCheckBox(groupList);
}

function hideCheckRunningBox(check, groupList) {
    check.showingCheckRunningBox = false;
    noteChangedCheckBox(groupList);
}

function showActionRunningBox(check, groupList) {
    check.__showingActionRunningBox = true;
    noteChangedCheckBox(groupList);
}

function hideActionRunningBox(check, groupList) {
    check.__showingActionRunningBox = false;
    noteChangedCheckBox(groupList);
}

const SelectedGroupsPanel = ({ groupList, env, historyList, info, toggleShowingChecksSearch}) => {

    if (groupList.error) return <FetchErrorBox error={groupList.error} message="Error loading checks from Foursight API" />
    return <div>
        { groupList.length > 0 /* selectedGroups.length > 0 */ ? (<>
            <div style={{paddingBottom:"3pt"}}>
                <b>Checks</b>
                <small id={`tooltip-search`} className="pointer" style={{marginLeft:"6pt",marginTop:"2pt"}} onClick={toggleShowingChecksSearch}>{Char.Search}</small>
                <Tooltip id={`tooltip-search`} position="right" shape="squared" size="small" text={"Click to search for checks."} />
            </div>
            { groupList.map((selectedGroup, index) /* selectedGroups?.map((selectedGroup, index) */ =>
                <SelectedGroupBox key={selectedGroup.group} group={selectedGroup} env={env} groupList={groupList} historyList={historyList} info={info} style={{paddingBottom:"6pt"}} />
            )}
        </>):(<></>)}
    </div>
}

const SelectedGroupBox = ({group, groupList, historyList, env, info, style = {}}) => {

    function toggleShowAllResults(checks, groupList) {
        if (isShowingAnyResults(checks)) {
            hideAllResults(checks, groupList);
        }
        else {
            showAllResults(checks, env, groupList);
        }
    }

    function isShowingAnyResults(checks) {
        for (let i = 0 ; i < checks?.length ; i++) {
            if (checks[i].__showingResults) {
                return true;
            }
        }
        return false;
    }

    function showAllResults(checks, env, groupList) {
        checks.map((check) => !check.__showingResults && showResultBox(check, env, groupList));
    }

    function hideAllResults(checks, groupList) {
        checks.map((check) => check.__showingResults && hideResultBox(check, groupList));
    }

    return <div style={style}>
        <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"4pt",minWidth:"500",maxWidth:"600pt"}}>
            <div>
                <span style={{cursor:"pointer"}} onClick={() => toggleShowAllResults(group?.checks, groupList)}>
                    <b>{group?.group.replace(/ checks$/i, "")} Group</b> {isShowingAnyResults(group?.checks) ? (<small>{Char.DownArrowFat}</small>) : (<small>{Char.UpArrowFat}</small>)}
                </span>
                <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideGroup(group, groupList, historyList)})}><b>{Char.X}</b></span>
            </div>
            <div style={{marginTop:"6pt"}} />
            { group?.checks?.sort((a,b) => a.title > b.title ? 1 : (a.title < b.title ? -1 : 0)).map((check, index) =>
                <div key={index}>
                    { index > 0 && <div style={{marginBottom:"12px"}} /> }
                    <SelectedGroupCheckBox check={check} env={env} groupList={groupList} historyList={historyList} info={info} />
                </div>
            )}
        </div>
    </div>
}

const SelectedGroupCheckBox = ({check, env, groupList, historyList, info }) => {

    const runActionAllowedState = useState(false);

    check.__result = useFetch({ cache: true });
    check.__resultByUuid = useFetch({ cache: true });
    check.__resultByAction = useFetch({ cache: true });

    useEffect(() => {
        fetchResult(check, env, groupList);
    }, []);

    function fetchResult(check, env, groupList, refresh = false) {
        check.__result.fetch({
            url: Server.Url(`/checks/${check.name}/history/latest`),
            nocache: refresh,
            onData: (data) => {
                fetchResultByUuid(check, data?.uuid, groupList, refresh);
                fetchResultByAction(check, data?.action, groupList, refresh);
            }
        });
    }

    function fetchResultByUuid(check, uuid, groupList, refresh = false) {
        if (uuid || check.__result.get("uuid")) {
            check.__resultByUuid.fetch({
                url: Server.Url(`/checks/${check.name}/history/${uuid || check.__result.get("uuid")}`),
                nocache: refresh,
                onDone: (response) => {
                    if (response.data?.checks) {
                        const responseByUuid = response.data.checks[check.title];
                        if (responseByUuid) {
                            if (Type.IsBoolean(responseByUuid.allow_action)) {
                                runActionAllowedState[1](responseByUuid.allow_action);
                            }
                        }
                    }
                }
            });
        }
    }

    function fetchResultByAction(check, action, groupList, refresh = false) {
        action = check.__result?.get("action") || action;
        if (action) {
            check.__resultByAction.fetch({
                url: Server.Url(`/checks/${action}/history/latest`),
                nocache: refresh
            });
        }
    }

    useEffect(() => {
        check.__showingResults = true;
        fetchResult(check, env, groupList);
    }, []);

    const [ showDependenciesBox, setShowDependenciesBox ] = useState(true);

    function toggleCheckResultsBox(check, env, groupList) {
        if (check.__showingResults) {
            hideResultBox(check, groupList);
        }
        else {
            showResultBox(check, env, groupList);
            setShowDependenciesBox(true);
        }
    }

    return <div>
        <div className="box check-box" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
        <table style={{width:"100%"}}>
            <tbody>
                <tr style={{height:"3pt"}}><td></td></tr>
                <tr>
                    <td style={{verticalAlign:"top",width:"1%","cursor":"pointer"}} onClick={() => {toggleCheckResultsBox(check, env, groupList)}}>
                        <b>{ isShowingSelectedCheckResultsBox(check) ? <small>{Char.DownArrowHollow}</small> : <small>{Char.RightArrowHollow}</small> }&nbsp;</b>
                    </td>
                    <td style={{veriticalAlign:"top",maxWidth:"480pt",width:"100%",whiteSpace:"nowrap"}}>
                        { (!check.__configuringCheckRun) ? <>
                            <div style={{marginLeft:"10pt",float:"right"}}>
                                <RunButton check={check} env={env} groupList={groupList} historyList={historyList} style={{marginTop:"-1pt"}} />
                            </div>
                        </>:<>
                            { (!check.__queueingCheckRun) && <>
                                <div id={`tooltip-configure ${check.name}`} 
                                    className={check.__configuringCheckRun ? "check-config-button" : "check-run-button"} style={{marginTop:"-2pt",float:"right"}}
                                    onClick={() => {
                                        if (check.__configuringCheckRun) {
                                            saveInputKwargs(check);
                                            check.__configuringCheckRun = false;
                                        }
                                        else {
                                            check.__configuringCheckRun = true;
                                        }
                                        noteChangedCheckBox(groupList);
                                            setShowDependenciesBox(true);
                                    }}>
                                    <span style={{fontSize:"small"}}></span>&nbsp;Run ...
                                </div>
                                <Tooltip id={`tooltip-configure ${check.name}`} position="top" text={"Configure check run below."} />
                            </>}
                        </>}
                        <span style={{whiteSpace:"nowrap"}}>
                            <u id={`tooltip-check-info ${check.name}`} style={{cursor:"pointer",fontWeight:isShowingSelectedCheckResultsBox(check) ? "bold" : "normal",whiteSpace:"break-spaces"}} onClick={() => {onClickShowHistory(check, env, historyList);}}>
                                {check.title?.length > 70 ? check.title.substring(0, 69) + " ..." : check.title}
                            </u>
                            <Tooltip id={`tooltip-check-info ${check.name}`} text={`Check: ${check.name}. Module: ${check.module}.`} />
                            { check.__result.get("action") && <u>
                                { runActionAllowedState[0] ? <>
                                    <span id={`tooltip-associated-action ${check.name}`} style={{color:"red"}}>&nbsp;{Char.Diamond}</span>
                                    <Tooltip id={`tooltip-associated-action ${check.name}`} text="This check has an associated (allowed) action." />
                                </>:<>
                                    <span id={`tooltip-associated-action-disallowed ${check.name}`}>&nbsp;{Char.Diamond}</span>
                                    <Tooltip id={`tooltip-associated-action-disallowed ${check.name}`} text="This check has an associated (disallowed) action." />
                                </>}
                            </u>}
                            &nbsp;&nbsp;<Link id={`tooltip-check-details ${check.name}`} to={Client.Path(`/checks/${check.name}/history`)} style={{color:"inherit"}} rel="noreferrer" target="_blank">
                                <div className="fa fa-external-link" style={{fontWeight:"bold",position:"relative",bottom:"-2px"}}></div>
                            </Link>
                            <Tooltip id={`tooltip-check-details ${check.name}`} text="Click to view check details and history (in new tab)." />
                            { check.registered_github_url && <>
                                <a id={`tooltip-view-source ${check.name}`} style={{marginLeft:"6pt",marginRight:"4pt"}} rel="noreferrer" target="_blank" href={check.registered_github_url}><img alt="github" src={Image.GitHubLoginLogo()} height="18"/></a>
                                <Tooltip id={`tooltip-view-source ${check.name}`} text="Click to view source code for this check (in new tab)." />
                            </>}
                            </span>
                            <ToggleHistoryButton check={check} env={env} historyList={historyList} />
                            {/* <RefreshResultButton check={check} style={{marginLeft:"10pt"}} /> */}
                            {/* TODO: As far as I can tell there is only every one element here under the schedule element */}
                            { Object.keys(check?.schedule).map((key, index) =>
                                <div key={key}>
                                    { Str.HasValue(check.schedule[key]?.cron_description) ? (
                                        <div style={{whiteSpace:"nowrap",width:"100%"}} key={index} title={check.schedule[key].cron}>
                                            <small><i>Schedule: <span id={`tooltip-cron-${check.name}`}>{check.schedule[key].cron_description}</span>.</i></small>
                                            <Tooltip id={`tooltip-cron-${check.name}`} text={check.schedule[key]?.cron} />
                                        </div>
                                    ):(
                                        <small><i>
                                            Not scheduled.
                                        </i></small>
                                    )}
                                </div>
                            )}
                            <CheckRunArgsBox
                                check={check}
                                env={env}
                                groupList={groupList}
                                historyList={historyList}
                                update={() => noteChangedCheckBox(groupList)}
                                showDependenciesBox={showDependenciesBox}
                                setShowDependenciesBox={setShowDependenciesBox} />
                            <CheckRunningBox check={check} groupList={groupList} info={info} />
                            <RunActionBox check={check} env={env} groupList={groupList} update={() => groupList.update()} fetchResult={fetchResult} runActionAllowedState={runActionAllowedState} />
                            <ActionRunningBox check={check} groupList={groupList} info={info} />
                            <ResultBox check={check} env={env} groupList={groupList} fetchResult={fetchResult} runActionAllowedState={runActionAllowedState} />
                        </td>
                    </tr>
                    <tr style={{height:"3pt"}}><td></td></tr>
                </tbody>
            </table>
        </div>
    </div>
}

const ToggleHistoryButton = ({ check, env, historyList, style }) => {
    return <span style={{...style, cursor:"pointer"}} onClick={() => onClickShowHistory(check, env, historyList)}>
        <span id={`tooltip-recent-history ${check.name}`}>
            <img alt="history" onClick={(e) => {}} src={Image.History()} style={{marginBottom:"2px",marginRight:"2pt",height:"18"}} />
        </span>
        <Tooltip id={`tooltip-recent-history ${check.name}`} text={"Click to " + (check.__showingHistory ? "hide" : "show") + " recent history of check runs."} />
        { check.__showingHistory ? <span>{Char.RightArrow}</span> : <></> }
    </span>
}

    const ResultBox = ({ check, env, groupList, fetchResult, runActionAllowedState }) => {

        const [showResultByUuid, setShowResultByUuid ] = useState(false);
        const [showResultByAction, setShowResultByAction ] = useState(false);

        function onClickResultBySummary(check) {
            setShowResultByUuid(false);
            setShowResultByAction(false);
        }

        function onClickResultByUuid(check, groupList) {
            setShowResultByUuid(true); 
            setShowResultByAction(false); 
        }

        function onClickResultByAction(check, groupList) {
            setShowResultByUuid(false); 
            setShowResultByAction(true); 
        }

        function onClickResult(check, groupList) {
            check.__showingResultDetails = !check.__showingResultDetails;
            noteChangedResults(groupList);
        }

        const RefreshResultButton = ({ check, env, checkUuid, groupList }) => {
            let tooltip;
            if (showResultByUuid) {
                if (check.__resultByUuid.loading) {
                    tooltip = `Fetching latest result: ${check.__result.get("uuid")}`;
                }
                else {
                    tooltip = `Click to fetch latest result: ${check.__result.get("uuid")}`;
                }
            }
            else {
                if (check.__result.loading) {
                    tooltip = "Fetching latest result.";
                }
                else {
                    tooltip = "Click to fetch latest result.";
                }
            }
            return <span style={{cursor:"pointer",color:"inherit",fontSize:"10pt",paddingBottom:"11pt"}} onClick={(e) => { fetchResult(check, env, groupList, true); }}>
                <b id={`tooltip-latest-result-history ${check.name}`}>{Char.Refresh}</b>
                <Tooltip id={`tooltip-latest-result-history ${check.name}`} text={tooltip} />
            </span>
        }

        if (check.__result.loading || check.__resultByUuid.loading || check.__resultByAction.loading) {
            return <>
                <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div>
                <StandardSpinner condition={check.__result.loading || check.__resultByUuid.loading || check.__resultByAction.loading} color={Styles.GetForegroundColor()} label={"Loading latest result"} />
            </>
        }
        return <div>
            { (check.__showingResults) && <small style={{color:check.__result.get("status")?.toUpperCase() === "PASS" ? "inherit" : "darkred",cursor:"pointer"}}>
                { !check.__result.empty ? (<>
                    { <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div> }
                    <span onClick={() => onClickResult(check, groupList)}>
                        <span id={`tooltip-latest-result ${check.name}`}>
                            <span><b>Latest Result</b></span>
                            { check.__showingResultDetails ? (
                                <b>&nbsp;{Char.DownArrow}</b>
                            ):(
                                <b>&nbsp;{Char.UpArrow}</b>
                            )}&nbsp;
                        </span>
                        <span id={`tooltip-latest-result-timestamp ${check.name}`}>{check.__result.get("timestamp")}</span>
                        <Tooltip id={`tooltip-latest-result ${check.name}`} text={"Click to " + (check.__showingResultDetails ? "hide" : "show") + " latest result."} />
                        <Tooltip id={`tooltip-latest-result-timestamp ${check.name}`} text={Duration.Format(check.__result.get("timestamp"), DateTime.Now(), true, null, null, "ago")} />
                    </span>
                    { check.__showingResultDetails && <>
                            {/**/}
                        { check.__result.get("uuid") ? <>
                            { showResultByUuid ? <>
                                { check.__result.get("action") ? <>
                                    &nbsp;|&nbsp;<span id={`tooltip-view-latest-result-summary ${check.name}`} onClick={() => onClickResultBySummary(check)}>Summary</span>
                                    &nbsp;|&nbsp;<b id={`tooltip-viewing-latest-result-detail ${check.name}`}>Check</b>
                                    &nbsp;|&nbsp;<span id={`tooltip-view-latest-action-result ${check.name}`} onClick={() => onClickResultByAction(check, groupList)}>Action</span>
                                    <Tooltip id={`tooltip-view-latest-result-summary ${check.name}`} text="Click to view latest check result summary." />
                                    <Tooltip id={`tooltip-viewing-latest-result-detail ${check.name}`} text="Viewing latest check result detail." />
                                    <Tooltip id={`tooltip-view-latest-action-result ${check.name}`} text="Click to view latest action result." />
                                </>:<>
                                    &nbsp;|&nbsp;<span id={`tooltip-view-latest-result-summary ${check.name}`} onClick={() => onClickResultBySummary(check)}>Summary</span>
                                    &nbsp;|&nbsp;<b id={`tooltip-viewing-latest-result-detail ${check.name}`}>Check</b>
                                    <Tooltip id={`tooltip-view-latest-result-summary ${check.name}`} text="Click to view latest check result summary." />
                                    <Tooltip id={`tooltip-viewing-latest-result-detail ${check.name}`} text="Viewing latest check result detail." />
                                </>}
                            </>:<>
                                { showResultByAction ? <>
                                    &nbsp;|&nbsp;<span id={`tooltip-view-latest-result-summary ${check.name}`} onClick={() => onClickResultBySummary(check)}>Summary</span>
                                    &nbsp;|&nbsp;<span id={`tooltip-view-latest-result-detail ${check.name}`} onClick={() => onClickResultByUuid(check, groupList)}>Check</span>
                                    &nbsp;|&nbsp;<b id={`tooltip-viewing-latest-action-result ${check.name}`}>Action</b>
                                    <Tooltip id={`tooltip-view-latest-result-summary ${check.name}`} text="Click to view latest check result summary." />
                                    <Tooltip id={`tooltip-view-latest-result-detail ${check.name}`} text="Click to view latest check result detail." />
                                    <Tooltip id={`tooltip-viewing-latest-action-result ${check.name}`} text="Viewing latest action result." />
                                </>:<>
                                    { check.__result.get("action") ? <>
                                        &nbsp;|&nbsp;<b id={`tooltip-viewing-latest-result-summary ${check.name}`}>Summary</b>
                                        &nbsp;|&nbsp;<span id={`tooltip-view-latest-result-detail ${check.name}`} onClick={() => onClickResultByUuid(check, groupList)}>Check</span>
                                        &nbsp;|&nbsp;<span id={`tooltip-view-latest-action-result ${check.name}`} onClick={() => onClickResultByAction(check, groupList)}>Action</span>
                                        <Tooltip id={`tooltip-viewing-latest-result-summary ${check.name}`} text="Viewing latest check result summary." />
                                        <Tooltip id={`tooltip-view-latest-result-detail ${check.name}`} text="Click to view latest check result detail." />
                                        <Tooltip id={`tooltip-view-latest-action-result ${check.name}`} text="Click to view latest action result." />
                                    </>:<>
                                        &nbsp;|&nbsp;<b id={`tooltip-viewing-latest-result-summary ${check.name}`}>Summary</b>
                                        &nbsp;|&nbsp;<span id={`tooltip-view-latest-result-detail ${check.name}`} onClick={() => onClickResultByUuid(check, groupList)}>Check</span>
                                        <Tooltip id={`tooltip-viewing-latest-result-summary ${check.name}`} text="Viewing latest check result summary." />
                                        <Tooltip id={`tooltip-view-latest-result-detail ${check.name}`} text="Click to view latest check result detail." />
                                    </>}
                                </>}
                            </>}
                        </>:<>
                            { check.__result.get("action") ? <>
                                { showResultByAction ? <>
                                    &nbsp;|&nbsp;<span id={`tooltip-view-latest-result-summary ${check.name}`} onClick={() => onClickResultBySummary(check)}>Summary</span>
                                    &nbsp;|&nbsp;<b id={`tooltip-viewing-latest-action-result ${check.name}`}>Action</b>
                                    <Tooltip id={`tooltip-view-latest-result-summary ${check.name}`} text="Click to view latest check result summary." />
                                    <Tooltip id={`tooltip-viewing-latest-action-result ${check.name}`} text="Viewing latest action result." />
                                </>:<>
                                    &nbsp;|&nbsp;<b>Summary</b>
                                    &nbsp;|&nbsp;<span id={`tooltip-view-latest-action-result ${check.name}`} onClick={() => onClickResultByAction(check)}>Action</span>
                                    <Tooltip id={`tooltip-view-latest-action-result ${check.name}`} text="Click to view latest action result." />
                                </>}
                            </>:<>
                                &nbsp;|&nbsp;<b>Summary</b>
                            </>}
                        </>}
                    </>}
                    &nbsp;|&nbsp;<RefreshResultButton check={check} env={env} groupList={groupList} />
                    <br />
                    <span style={{color:check.__result.get("status")?.toUpperCase() === "PASS" ? "inherit" : "darkred"}} onClick={() => onClickResult(check, groupList)}>
                        <span>Summary</span>:&nbsp;
                        <span style={{whiteSpace:"break-spaces"}}>
                            {check.__result.get("summary")}&nbsp;&nbsp;
                            {check.__result.get("status")?.toUpperCase() === "PASS" ? (<b style={{fontSize:"12pt",color:"inherit"}}>{Char.Check}</b>) : (<b style={{fontSize:"13pt",color:"darkred"}}>{Char.X}</b>)}
                        </span>
                        { (check.__result.get("description") && check.__result.get("description") !== check.__result.get("summary")) && <>
                            <span style={{whiteSpace:"break-spaces"}}>
                                <br />Description: {check.__result.get("description")}
                            </span>
                        </>}
                        { (check.__result.get("ff_link")) && <>
                            &nbsp;<a style={{color:"inherit"}} href={check.__result.get("ff_link")} rel="noreferrer" target="_blank">
                                <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px"}}></span>
                            </a>
                        </>}
                    </span>
                </>):(<>
                    { !check.__showingResultDetails && <>
                        <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div>
                        <span>No recent result</span>&nbsp;|&nbsp;<RefreshResultButton check={check} env={env} groupList={groupList} />
                    </>}
                </>)}
            </small> }
            { (check.__showingResultDetails && (!check.__result.empty || !check.__resultByUuid.empty || !check.__resultByAction.empty)) && <>
                <div style={{height:"2pt"}} />
                <ResultDetailsBox check={check} groupList={groupList} showResultByUuid={showResultByUuid} showResultByAction={showResultByAction} />
            </>}
        </div>
    }

    const ResultDetailsBox = ({check, groupList, showResultByUuid, showResultByAction, style}) => {
        if (!check.__showingResults) return <></>
        if (showResultByUuid) {
            return <pre className="box lighten" style={{wordWrap:"break-word",paddingBottom:"4pt",marginBottom:"3px",marginTop:"3px",marginRight:"5pt",minWidth:"360pt",maxWidth:"100%"}}>
                <div style={{float:"right",marginTop:"0px"}}>
                    <span style={{fontSize:"0",opacity:"0"}} id={check.name}>{Json.Str(check.__resultByUuid.get())}</span>
                    <img alt="copy" onClick={() => Clipboard.Copy(check.name)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                    &nbsp;<span style={{fontSize:"large",cursor:"pointer",color:"black"}} onClick={() => { check.__showingResultDetails = false ; noteChangedResults(groupList); }}>X</span>
                </div>
                { (check.__result.loading || check.__resultByUuid.loading || check.__resultByAction.loading) ? <>
                    <StandardSpinner condition={check.__result.loading || check.__resultByUuid.loading || check.__resultByAction.loading} color={Styles.GetForegroundColor()} label={"Loading latest result "}/>
                </>:<>
                    {Yaml.Format(check.__resultByUuid.get())}
                </>}
            </pre>
        }
        if (showResultByAction) {
            return <pre className="box lighten" style={{wordWrap:"break-word",paddingBottom:"4pt",marginBottom:"3px",marginTop:"3px",marginRight:"5pt",minWidth:"360pt",maxWidth:"100%"}}>
                <div style={{float:"right",marginTop:"0px"}}>
                    <span style={{fontSize:"0",opacity:"0"}} id={check.name}>{Json.Str(check.__resultByAction.get())}</span>
                    <img alt="copy" onClick={() => Clipboard.Copy(check.name)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                    &nbsp;<span style={{fontSize:"large",cursor:"pointer",color:"black"}} onClick={() => { check.__showingResultDetails = false ; noteChangedResults(groupList); }}>X</span>
                </div>
                { (check.__result.loading || check.__resultByUuid.loading || check.__resultByAction.loading) ? <>
                    <StandardSpinner condition={check.__result.loading || check.__resultByUuid.loading || check.__resultByAction.loading} color={Styles.GetForegroundColor()} label={"Loading latest result "}/>
                </>:<>{Yaml.Format(check.__resultByAction.get())}</>}
            </pre>
        }
        return <pre className="box lighten" style={{color:check.__result.get("status")?.toUpperCase() === "PASS" ? "inherit" : "darkred",wordWrap:"break-word",paddingBottom:"4pt",marginBottom:"3px",marginTop:"3px",marginRight:"5pt",minWidth:"360pt",maxWidth:"100%"}}>
            <div style={{float:"right",marginTop:"-10px"}}>
            <span style={{fontSize:"0",opacity:"0"}} id={check.name}>{Json.Str(check.showingResultDetailsFull ? check.__result.get("full_output") : check.__result.get())}</span>
            <img alt="copy" onClick={() => Clipboard.Copy(check.name)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
            &nbsp;<span style={{fontSize:"x-large",cursor:"pointer",color:"black"}} onClick={() => {check.showingResultDetailsFull = !check.showingResultDetailsFull; noteChangedResults(groupList); } }>{check.showingResultDetailsFull ? <span title="Show full result output.">{Char.UpArrow}</span> : <span>{Char.DownArrow}</span>}</span>
            &nbsp;<span style={{fontSize:"large",cursor:"pointer",color:"black"}} onClick={() => { check.__showingResultDetails = false ; noteChangedResults(groupList); }}>X</span>
            </div>
            { (check.__result.loading || check.__resultByUuid.loading || check.__resultByAction.loading) ?
                <StandardSpinner condition={check.__result.loading || check.__resultByUuid.loading || check.__resultByAction.loading} color={Styles.GetForegroundColor()} label={"Loading latest result "}/>
            :
                ( !check.__result.empty ?
                    (Yaml.Format(check.showingResultDetailsFull ? check.__result.get("full_output") : check.__result.get()))
                :
                    <div style={{marginTop:"1pt"}}>No result.</div>
                )
            }
        </pre>
    }

    // This RunButton is context sensitive. As it first appears clicking on it will
    // just show the run args configuration box (and then that button will turn into
    // a configure button which when clicked will hide the args configuration box);
    // and when the args configuration box is showing this RunButton, which will be
    // place inside the args configuration box, will actually run the check when clicked.
    //
    const RunButton = ({ check, env, groupList, historyList, style }) => {
        const [ readOnlyMode ] = useReadOnlyMode();
        const fetch = useFetchFunction();
        if (check.__queueingCheckRun) {
            return check.__queueingCheckRun && <div className={"check-run-wait-button"} style={style}>
                <span id="tooltip-queueing">
                     <i>Queueing</i>
                 </span>
                <Tooltip id="tooltip-queueing" text="Wait until check run queueing completes." />
            </div>
        }

        const tooltipId = `tooltip-run-button ${check.name}`;
        const tooltip = check.__configuringCheckRun ? (readOnlyMode
                                                       ? "Run check disabled due to readonly mode."
                                                       : "Click to actually run this check.")
                                                    : (readOnlyMode
                                                       ? "Click to configure a check run. But run is disabled due to readonly mode."
                                                       : "Click to configure a check run.");
        return <div>
            <Tooltip id={tooltipId} text={tooltip} />
            <div id={tooltipId} className={"check-run-button" + (check.__configuringCheckRun ? "" : "")} style={{...style, cursor:readOnlyMode && check.__configuringCheckRun ? "not-allowed" : "",background:readOnlyMode && check.__configuringCheckRun ? "#888888" : "",color:check.__configuringCheckRun ? "yellow" : ""}}
                onClick={(e) => {
                    if (check.__configuringCheckRun) {
                        if (!readOnlyMode) {
                            saveInputKwargs(check);
                            doRunCheck(check, env, groupList, historyList, fetch);
                        }
                    }
                    else {
                        check.__configuringCheckRun = true;
                        noteChangedCheckBox(groupList);
                    }
                }}>
                <span>
                    { !readOnlyMode ? <>
                        { check.__configuringCheckRun ? <>
                            <span style={{fontSize:"small"}}>{Char.RightArrowFat}</span>&nbsp;<span>Run Check</span>
                        </>:<>
                            <span>&nbsp;Run <b>...</b></span>
                        </>}
                    </>:<>
                        { check.__configuringCheckRun ? <>
                            <span style={{fontSize:"",color:"white",background:"#888888"}}><small>&nbsp;</small>Run Check Disabled</span>
                        </>:<>
                            <span style={{fontSize:"normal"}}>&nbsp;Run ...</span>
                        </>}
                    </>}
                </span>
            </div>
        </div>
    }

    // What a pain ...
    const CheckRunArgsBox = ({ check, env, groupList, historyList, update, showDependenciesBox, setShowDependenciesBox}) => {

        // This is a bit tedious to unwrap. This is what a check record looks like:
        // {
        //     "title": "ES Disk Space Check",
        //     "name": "elastic_search_space",
        //     "group": "Elasticsearch checks",
        //     "module": "system_checks",
        //     "schedule": {
        //         "morning_checks_1": {
        //             "all": {
        //                 "kwargs": {
        //                     "dependencies": [],
        //                     "primary": true
        //                  },
        //                  "dependencies": []
        //             },
        //             "cron": "0 6 * * ? *",
        //             "cron_description": "06:00 AM"
        //         }
        //     },
        //     "registered_kwargs": {
        //         "time_limit": 480
        //     }
        // }
        //
        // See foursight_core/react_api.py for how this gets put together, from the
        // original from check_setup.json and annotated with schedule info from lambdas
        // and extra (registered) kwargs from the check_function decorators.
        //
        function getKwargsFromCheck(check) {
            let kwargs = {};
            for (let schedule_key of Object.keys(check?.schedule)) {
                for (let schedule_env_key of Object.keys(check.schedule[schedule_key])) {
                    if (schedule_env_key.toLowerCase() === "all" || Env.Equals(schedule_env_key, env)) {
                        kwargs = check.schedule[schedule_key][schedule_env_key]["kwargs"]
                        break;
                    }
                }
            }
            let registered_kwargs = check?.registered_kwargs;
            if (registered_kwargs) {
                //
                // Order here matters; have the kwargs override the registered kwargs.
                // actually comes up for example for the wrangler_checks.core_project_status.
                //
                kwargs = {...registered_kwargs, ...kwargs}
            }
            return kwargs;
        }

        function getDependenciesFromCheck(checkInfo) {
            const schedule = checkInfo.schedule;
            if (schedule) {
                const scheduleValues = Object.values(schedule);
                if (scheduleValues && scheduleValues.length > 0) {
                    const scheduleFirstElement = scheduleValues[0];
                    if (scheduleFirstElement) {
                        const scheduleFirstElementEnv = scheduleFirstElement[Env.PreferredName(Env.Current())];
                        if (scheduleFirstElementEnv && scheduleFirstElementEnv?.dependencies?.length > 0) {
                            return scheduleFirstElementEnv.dependencies;
                        }
                    }
                }
            }
            return [];
        }

        // const [ showDependenciesBox, setShowDependenciesBox ] = useState();

        if (!Type.IsNonEmptyObject(check.kwargs)) {
            check.kwargs = getKwargsFromCheck(check);
        }
        return check.__configuringCheckRun && <>
            { (getDependenciesFromCheck(check).length > 0) && showDependenciesBox && <>
                <div className="box bigmargin" style={{background:"#EFEFEF",paddingTop:"4pt",paddingBottom:"4pt"}}>
                    <small><b className="pointer" style={{float:"right"}} onClick={() => setShowDependenciesBox(false)}>{Char.X}</b></small>
                    { getDependenciesFromCheck(check).map((dependency, index) => <React.Fragment key={dependency}>
                       <table style={{color:Styles.GetForegroundColor()}}><tbody><tr><td valign="top"><b>&#x27A6;</b>&nbsp;</td><td>
                        <small style={{whiteSpace:"break-spaces"}}><i>Just FYI this check has dependencies:</i>&nbsp;
                            {index > 0 && <span>, </span>}
                            <Link to={Client.Path(`/checks/${dependency}/history`)} target="_blank">{dependency}</Link>
                        </small>
                        </td></tr></tbody></table>
                    </React.Fragment>)}
                </div>
            </>}
            <div className="box thickborder" style={{marginTop:"4pt",padding:"6pt",cursor:"default",background:"lightyellow"}} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                { (Type.IsNonEmptyObject(check.kwargs)) ? (<>
                    <div style={{marginTop:"-2pt",float:"right"}}>
                        <RunButton check={check} env={env} groupList={groupList} historyList={historyList} style={{float:"right"}} />
                    </div>
                    <table style={{fontSize:"small",marginTop:"0pt"}}><tbody>
                    { Object.keys(check.kwargs).filter(key => key !== "queue_action").sort().map(key =>
                        <tr key={Uuid()} style={{}}>
                            <td align="top">
                                <b>{key}</b>:&nbsp;&nbsp;
                            </td>
                            <td style={{padding:"1pt"}} align="top">
                            { (Type.IsBoolean(check.kwargs[key])) &&
                                <select defaultValue={check.kwargs[key] ? "true" : "false"} style={{background:"lightyellow",border:"1px solid lightgray",borderRadius:"4pt"}}
                                    onChange={(e) => {
                                        check.kwargs[key] = e.target.value === "true" ? true : false;
                                        noteChangedCheckBox(groupList);
                                    }}>
                                    { check.kwargs[key] ? <>
                                        <option>true</option>
                                        <option>false</option>
                                    </>:<>
                                        <option>true</option>
                                        <option>false</option>
                                    </>}
                                </select> 
                            }
                            { (Type.IsNonEmptyArray(check.kwargs[key])) &&
                                <select key={Uuid()} defaultValue={check.kwargs[key]?.__selected} style={{background:"lightyellow",border:"1px solid lightgray"}}
                                    onChange={(e) => {
                                        check.kwargs[key].__selected = e.target.value;
                                        noteChangedCheckBox(groupList);
                                    }}>
                                    { check.kwargs[key].map(item =>
                                        <option key={Uuid()}>{item}</option>
                                    )}
                                </select>
                            }
                            { (!Type.IsBoolean(check.kwargs[key]) && !Type.IsNonEmptyArray(check.kwargs[key])) && <>
                                {/*
                                    Input box focus issues were very tricky with onChange and setting state et cetera;
                                    tried many things; finally came upon functionally simple solution (though code is
                                    slightly arcane) of reading input values directly from the input elements when the
                                    run button is clicked. See RunButton. Perhaps the non-input type (e.g. dropdown)
                                    values should be done this way too, thereby avoiding setting state at all during
                                    run args configuration process, but leave it for now.
                                */}
                                <input
                                    id={`${check.name}.${key}`}
                                    defaultValue={check.kwargs[key]}
                                    placeholder="Empty"
                                    onBlur={() => {saveInputKwargs(check)}}
                                    style={{marginLeft:"0pt",height:"14pt",background:"lightyellow",border:"1px solid lightgray",borderRadius:"2pt"}}
                                    />
                            </>}
                            &nbsp;&nbsp;</td>
                        </tr>
                    )}
                    </tbody></table>
                </>):(<>
                    <div style={{marginTop:"-3pt",float:"right"}}>
                        <RunButton check={check} env={env} groupList={groupList} historyList={historyList} style={{float:"right"}} />
                    </div>
                    No arguments.
                </>)}
            </div>
        </>
    }

    // The (yellow) check running box.
    const CheckRunningBox = ({ check, groupList, info }) => {
        const [ showUuid, setShowUuid ] = useState(false);
        return (!check.showingCheckRunningBox || !check.__configuringCheckRun) ? <span /> : <div>
            <div className="box" style={{marginTop:"4pt",padding:"6pt",cursor:"default",borderColor:"red",background:"yellow",filter:"brightness(0.9)"}}>
                { (check.__queuedCheckRun) &&
                    <small><b>
                        <span id={`tooltip-view-run-uuid-1 ${check.name}`} onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>Queued check run</span>:&nbsp;
                        <span id={`tooltip-view-run-uuid-2 ${check.name}`} onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>{DateTime.Format(check.__queuedCheckRun + "+00:00")}</span>
                        <Tooltip id={`tooltip-view-run-uuid-1 ${check.name}`} text={"Click to " + (showUuid ? "hide" : "show") + " UUID for this check run."} position="bottom" />
                        <Tooltip id={`tooltip-view-run-uuid-2 ${check.name}`} text={"Click to " + (showUuid ? "hide" : "show") + " UUID for this check run."} position="bottom" />
                        &nbsp;{Char.RightArrow}&nbsp;
                        { showUuid ? <>
                            <a  id={`tooltip-view-run-s3 ${check.name}`} rel="noreferrer" target="_blank" onClick={(e) => {}} href={`https://s3.console.aws.amazon.com/s3/object/${info.get("checks.bucket")}?region=us-east-1&prefix=${check.name}/${check.__queuedCheckRun}.json`} style={{color:"inherit"}}><u>{check.__queuedCheckRun}</u></a>
                            <Tooltip id={`tooltip-view-run-s3 ${check.name}`} text="Click to view check run result in AWS S3 (in new tab)." position="bottom" />
                        </>:<>
                            <span id={`tooltip-view-run-uuid-3 ${check.name}`} onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>OK</span>
                            <Tooltip id={`tooltip-view-run-uuid-3 ${check.name}`} text="Click to view UUID for this check run." position="bottom" />
                        </>}
                        <div style={{float:"right",marginTop:"-0pt",cursor:"pointer"}} onClick={() => {hideCheckRunningBox(check, groupList); }}>&nbsp;<b>{Char.X}</b>&nbsp;</div>
                    </b></small>
                }
                { !check.__queuedCheckRun && <div style={{marginTop:"-2pt"}}><StandardSpinner condition={check.__queueingCheckRun} label={" Queueing check run"} color={"darkred"} /></div> }
            </div>
        </div>
    } 

    // The (yellow) action running box.
    const ActionRunningBox = ({ check, groupList, info }) => {
        const [ showUuid, setShowUuid ] = useState(false);
        return (!check.__showingActionRunningBox || !check.__configuringCheckRun) ? <span /> : <div>
            <div className="box" style={{marginTop:"4pt",padding:"6pt",cursor:"default",borderColor:"red",color:"darkred",background:"yellow",filter:"brightness(0.9)"}}>
                {  check.__queuedActionRun &&
                    <small><b>
                        <span id={`tooltip-view-run-action-uuid-1 ${check.name}`} onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>Queued action run</span>:&nbsp;
                        <span id={`tooltip-view-run-action-uuid-2 ${check.name}`} onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>{DateTime.Format(check.__queuedActionRun + "+00:00")}</span>
                        <Tooltip id={`tooltip-view-run-action-uuid-1 ${check.name}`} text={"Click to " + (showUuid ? "hide" : "show") + " UUID for this action run."} position="bottom" />
                        <Tooltip id={`tooltip-view-run-action-uuid-2 ${check.name}`} text={"Click to " + (showUuid ? "hide" : "show") + " UUID for this action run."} position="bottom" />
                        &nbsp;{Char.RightArrow}&nbsp;
                        { showUuid ? <>
                            <a id={`tooltip-view-run-action-s3 ${check.name}`} rel="noreferrer" target="_blank" onClick={(e) => {}} href={`https://s3.console.aws.amazon.com/s3/object/${info.get("checks.bucket")}?region=us-east-1&prefix=${check.__result.get("action")}/${check.__queuedActionRun}.json`} style={{color:"inherit"}}><u>{check.__queuedActionRun}</u></a>
                            <Tooltip id={`tooltip-view-run-action-s3 ${check.name}`} text="Click to view action run result in AWS S3 (in new tab)." position="bottom" />
                        </>:<>
                            <span id={`tooltip-view-run-action-uuid-3 ${check.name}`} onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>OK</span>
                            <Tooltip id={`tooltip-view-run-action-uuid-3 ${check.name}`} text="Click to view UUID for this action run." position="bottom" />
                        </>}
                        <div style={{float:"right",marginTop:"-0pt",cursor:"pointer"}} onClick={() => {hideActionRunningBox(check, groupList); }}>&nbsp;{Char.X}</div>
                    </b></small>
                }
                { !check.__queuedActionRun && <div style={{marginTop:"-2pt"}}><StandardSpinner condition={check.__queueingActionRun} label={" Queueing action run"} color={"darkred"} /></div> }
            </div>
        </div>
    } 


    const ResultsHistoryPanel = ({ env, historyList }) => {
        if (historyList.error) {
            return <FetchErrorBox error={historyList.error} message="Error loading check history from Foursight API" />
        }
        let histories = historyList.filter((check) => check.__showingHistory);
        if (!histories || histories.length <= 0) {
            return <span />
        }
        return <div>
            <b style={{marginBottom:"100pt"}}>Recent Results</b>
            { histories?.map((selectedHistory, index) =>
                <div key={selectedHistory.name} style={{marginTop:"3pt"}}>
                    <ResultsHistoryBox check={selectedHistory} env={env} historyList={historyList} />
                </div>
            )}
        </div>
    }

const ResultsHistoryBox = ({ check, env, historyList }) => {

    function showHistoryResult(check, history, uuid, historyList) {
        history.__resultShowing = true;
        history.__resultLoading = true;
        historyList.update();
        historyList.refresh({
            url: Server.Url(`/checks/${check.name}/history/${uuid}`),
            onData: (data, current) => {
                if (history.__resultShowing) {
                    history.__result = data;
                }
                return current;
            },
            onDone: (response) => {
                history.__resultLoading = false;
            }
        });
    }

    function hideHistoryResult(history, historyList) {
        history.__resultShowing = false;
        history.__result = null;
        history.__resultLoading = false;
        historyList.update();
    }

    function toggleHistoryResult(check, history, uuid, historyList) {
        if (history.__resultShowing) {
            hideHistoryResult(history, historyList);
        }
        else {
            showHistoryResult(check, history, uuid, historyList);
        }
    }

    function extractUuid(history) {
        return !history ? "uuid" : history[2].uuid;
    }
    function extractStatus(history) {
        return !history ? "status" : history[0];
    }
    function extractTimestamp(history) {
        return !history ? "timestamp" : history[2].timestamp;
    }
    function extractDuration(history) {
        return !history ? "duration" : history[2].runtime_seconds;
    }
    function extractState(history) {
        return !history ? "state" : history[2].queue_action;
    }

    const columns = [
        { label: "__refresh" },
        { label: "Timestamp", key: extractTimestamp },
        { label: "Status", key: extractStatus},
        { label: "Duration", key: extractDuration, align: "right" },
        { label: "State", key: extractState }
    ];

    function useFetchHistory(refresh = false) {
        return useFetch({ url: Server.Url(`/checks/${check.name}/history`), nofetch: true, cache: true });
    }

    function fetchHistory(refresh = false) {
        check.__resultHistory.fetch({ nocache: refresh });
    }

    function refreshHistory() {
        fetchHistory(true);
    }

    check.__resultHistory = useFetchHistory();

    useEffect(() => {
        fetchHistory();
    }, []);

    return <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"8pt",maxWidth:"525pt"}}>
        <div>
            <b>
                <Link id={`tooltip-history-check-name-${check.name}`} to={Client.Path(`/checks/${check.name}/history`)} style={{color:"inherit"}} rel="noreferrer" target="_blank">{check.title}</Link>
                <Tooltip id={`tooltip-history-check-name-${check.name}`} text={`Check: ${check.name}. Module: ${check.module}. Group: ${check.group}.`} position="bottom" />
            </b>&nbsp;
            &nbsp;<Link to={Client.Path(`/checks/${check.name}/history`)} rel="noreferrer" target="_blank">
                <b id={`tooltip-history-full-${check.name}`} className="fa fa-external-link" style={{color:"black",fontWeight:"bold",position:"relative",bottom:"-3px"}}></b>
                <Tooltip id={`tooltip-history-full-${check.name}`} text="Click for full history (in new tab)." position="bottom" offset={-3} />
            </Link>
            { check.registered_github_url && <>
                &nbsp;<a id={`tooltip-history-source-${check.name}`} style={{marginLeft:"4pt",marginRight:"6pt"}} rel="noreferrer" target="_blank" href={check.registered_github_url}><img alt="github" src={Image.GitHubLoginLogo()} height="18"/></a>
                <Tooltip id={`tooltip-history-source-${check.name}`} text="Click to view source code for this check (in new tab)." />
            </>}
            <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideHistory(check, historyList)})}>&nbsp;&nbsp;<b>{Char.X}</b></span>
        </div>
        <div style={{marginBottom:"6pt"}}/>
        { check.__showingHistory && (<>
            { check.__resultHistory?.data?.list?.length > 0 ? (<>
                <table style={{width:"100%"}}>
                    <TableHead
                        loading={check.__resultHistory.loading}
                        columns={columns}
                        list={check.__resultHistory.data.list}
                        refresh={refreshHistory}
                        update={(e) => historyList.update()}
                        style={{color:Styles.GetForegroundColor(),fontWeight:"bold"}}
                        lines={true} />
                <tbody>
                {check.__resultHistory.data.list.map((history, index) => <React.Fragment key={index}>
                    <React.Fragment key={extractUuid(history)}>
                        { index !== 0 && (<>
                            <tr><td style={{paddingTop:"2px"}}></td></tr>
                            <tr><td style={{height:"1px",background:"gray"}} colSpan="5"></td></tr>
                            <tr><td style={{paddingBottom:"2px"}}></td></tr>
                        </>)}
                        <tr>
                        <td>
                            {extractStatus(history) === "PASS" ?
                                <span style={{color:"inherit"}}>{Char.Check}</span>
                            :   <span style={{color:"darkred"}}>{Char.X}</span> }
                        &nbsp;&nbsp;</td>
                        <td style={{whiteSpace:"nowrap"}}>
                            <span id={`tooltip-history-timestamp-${check.name}-${index}`} onClick={() => {toggleHistoryResult(check, history, extractUuid(history), historyList); }} style={{cursor:"pointer"}}>
                                {DateTime.Format(extractTimestamp(history))}
                            </span>
                            <Tooltip id={`tooltip-history-timestamp-${check.name}-${index}`} text={Time.Ago(extractTimestamp(history))} position="right" shape="squared" />
                        &nbsp;&nbsp;</td>
                        <td style={{whiteSpace:"nowrap"}}>
                            {extractStatus(history) === "PASS" ? (<>
                                <b style={{color:"inherit"}}>OK</b>
                            </>):(<>
                                <DisplayStatusText status={extractStatus(history)} />
                            </>)}
                        &nbsp;&nbsp;</td>
                        <td style={{textAlign:"right"}}>
                            {extractDuration(history)}
                        &nbsp;&nbsp;</td>
                        <td style={{whiteSpace:"nowrap"}}>
                            { extractStatus(history) === "PASS" && extractState(history) === "Not queued" ? <>
                                Done
                            </>:<>
                                {extractState(history)}
                            </>}
                        &nbsp;&nbsp;</td>
                        </tr>
                    </React.Fragment>
                    { (history.__resultShowing) &&
                        <tr>
                            <td colSpan="6">
                                <pre className="box lighten" style={{wordWrap: "break-word",paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"4pt",marginTop:"4pt",marginRight:"5pt",width:"fit-content",minWidth:"360pt",maxWidth:"500pt"}}>
                                    { history.__resultLoading ? <>
                                        <StandardSpinner condition={history.__resultLoading} color={Styles.GetForegroundColor()} label="Loading result"/>
                                    </>:<>
                                        <div style={{float:"right",marginTop:"-0px"}}>
                                            <span style={{fontSize:"0",opacity:"0"}} id={check.name}>{Json.Str(history.__result)}</span>
                                            <img alt="copy" onClick={() => Clipboard.Copy(check.name)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                                            <span onClick={() => hideHistoryResult(history, historyList)} style={{marginLeft:"6pt",marginRight:"2pt",fontSize:"large",fontWeight:"bold",cursor:"pointer"}}>X</span>
                                        </div>
                                        {Yaml.Format(history.__result)}
                                    </>}
                                </pre>
                            </td>
                        </tr>
                    }
                </React.Fragment>)}
                </tbody>
                </table>
            </>):(<>
                { (!check.__resultHistory.loading) ? (<>
                    <div style={{color:"black", borderTop:"1px solid", paddingTop:"4pt"}}>
                        { check.__resultHistory.loading ? <>
                            <StandardSpinner condition={check.__resultHistory.loading} color={Styles.GetForegroundColor()} label="Loading history" style={{}} />
                        </>:<>
                            No history &nbsp;
                            <b onClick={() => refreshHistory()} style={{cursor:"pointer"}}>{Char.Refresh}</b>
                        </>}
                    </div>
                </>):(<>
                    <div style={{color:"black", borderTop:"1px solid",marginBottom:"3pt"}} />
                    <StandardSpinner condition={check.__resultHistory.loading} color={Styles.GetForegroundColor()} label="Loading history" />
                </>)}
            </>)}
        </>)}
    </div>
}

const ChecksSearchControl = (props) => {
    return <>
       &nbsp;<span style={{fontWeight:props.showingChecksSearch ? "bold" : "normal"}} onClick={props.toggleShowingChecksSearch}>
            <span style={{color:"inherit",marginRight:"6pt"}}>Search Checks</span>{Char.Search}&nbsp;&nbsp;
            <img alt="new" style={{float:"right",marginTop:"-8pt",marginRight:"-4pt"}} src={Image.NewIcon()} height="42" />
        </span> <br />
    </>
}

const ChecksSearchBox = (props) => {

    const [ checksSearch, setChecksSearch ] = useState("");
    const [ filteredChecks, setFilteredChecks ] = useState([]);

    useEffect(() => {
        setChecksSearch(checksSearch);
    }, [checksSearch]);

    function onChecksSearch(e) {
        const search = e.currentTarget.value;
        setChecksSearch(search);
        setFilteredChecks(filterChecks(search));
    }

    function filterChecks(search) {
        if (!search || search.trim().length < 1) {
            return [];
        }
        search = search.trim().replace(/\s+/g, ' ').toLowerCase();
        let matches = []
        props.checks.forEach(group => {
            const matchedChecks = group?.checks?.filter(check =>
                check.name.trim().toLowerCase().includes(search) ||
                check.title.trim().toLowerCase().includes(search) ||
                check.group.trim().toLowerCase().includes(search)
            );
            matches.push(...matchedChecks)
        });
        matches.sort((a,b) => a.title.trim().toLowerCase() > b.title.trim().toLowerCase() ? 1 : (a.title.trim().toLowerCase() < b.title.trim().toLowerCase() ? -1 : 0));
        return matches;
    }

    function getGroupName(check) {
        return getByScheduleGroupName(check);
    }

    function getByScheduleGroupName(check) {
        let checkName = check.name;
        for (let datum of props.checks.data) {
            for (let check of datum.checks) {
                if (check.name == checkName) {
                    return datum.group;
                }
            }
        }
    }

    const inputStyle = {
        outline: "none",
        paddingLeft: "2pt",
     // border: "1px solid gray",
        borderBottom: "0",
        borderTop: "0",
        borderRight: "0",
        borderLeft: "0",
        position: "relative",
        bottom: "1pt",
        fontWeight: "bold",
        color: "var(--box-fg)",
        marginBottom: "-2pt",
        height: "1.2em",
        width: "100%"
    };

    return props.showingChecksSearch && <>
        <div>
            <table width="90%"><tbody><tr>
                <td nowrap="1" width="2%">
                    <b style={{color:"var(--box-fg)"}}>Search Checks</b>:&nbsp;
                </td>
                <td>
                    <input placeholder="Search for checks ..." type="text" autoFocus style={inputStyle} defaultValue={checksSearch} onChange={onChecksSearch} />
                </td>
            </tr></tbody></table>
        </div>
        <div className="box lighten bigmargin" style={{marginBottom:"6pt",minWidth:"250pt",maxWidth:"540pt"}}>
            <div style={{fontSize:"small",paddingTop:"2pt",marginBottom:"-3pt"}}>
                <div style={{float:"right",marginTop:"-6pt",marginRight:"-3pt",cursor:"pointer"}} onClick={() => props.toggleShowingChecksSearch()}>
                    <b>{Char.X}</b>
                </div>
                {filteredChecks.length > 0 ? <div style={{marginTop:"4pt"}}>
                    {filteredChecks.map(check => <table key={check.name}><tbody>
                        <tr>
                            <td style={{verticalAlign:"top",paddingTop:"4pt",paddingRight:"6pt"}}>
                                <Link to={Client.Path(`/checks/${check.name}/history`)} style={{color:"inherit",marginTop:"800pt"}} rel="noreferrer" target="_blank">
                                    <b id={`tooltip-search-full-history-${check.name}`} className="fa fa-external-link" style={{color:"black",fontSize:"11pt"}}></b>
                                    <Tooltip id={`tooltip-search-full-history-${check.name}`} text="Click for full history (in new tab)." position="bottom" />
                                </Link>
                            </td>
                            <td style={{verticalAlign:"top",paddingBottom:"10pt",whiteSpace:"break-spaces"}}>
                                <Link to={Client.Path(`/checks/${check.name}/history`)} style={{color:"inherit",marginTop:"800pt"}} rel="noreferrer" target="_blank">
                                    <b><u>{check.title}</u></b>
                                </Link>
                                { check.registered_github_url && <>
                                    <a id={`tooltip-search-${check.name}`} style={{marginLeft:"4pt",marginRight:"4pt"}} rel="noreferrer" target="_blank" href={check.registered_github_url}><img alt="github" src={Image.GitHubLoginLogo()} height="18"/></a>
                                    <Tooltip id={`tooltip-search-${check.name}`} text="Click to view source code for this check (in new tab)." position="bottom" />
                                </>}
                                <br />
                                <small>
                                    <i>Group</i>:&nbsp;
                                    <span className="pointer" onClick={() => props.toggleShowGroup(props.findGroup(getGroupName(check)), props.environ, props.groupList)}>{getGroupName(check).replace(/ checks$/i, "")}</span> <br />
                                    <i>Function:</i>&nbsp;
                                    { check.registered_github_url ? <>
                                        <a rel="noreferrer" target="_blank" href={check.registered_github_url}>
                                            <span style={{color:"darkblue"}}>{check.module}<b style={{marginLeft:"2px",marginRight:"2px"}}>.</b>{check.name}</span>
                                        </a>
                                    </>:<>
                                        {check.module}<b style={{marginLeft:"2px",marginRight:"2px"}}>.</b>{check.name}
                                    </>}
                                    { Object.keys(check?.schedule)?.length == 1 && <>
                                        <br />
                                        <small><i>Schedule:</i> {check.schedule[Object.keys(check.schedule)[0]]?.cron_description}</small>
                                    </> }
                                </small>
                            </td>
                        </tr>
                    </tbody></table>)}
                </div>:<>
                    <div style={{marginTop:"-6pt"}}>
                        No results.
                    </div>
                </>}
            </div>
        </div>
    </>
}

const ChecksPage = (props) => {

    // TODO: Lotsa refactoring ...

    let { environ } = useParams();
    const historyList = useFetch({ initial: [] });
    const groupList = useFetch({ initial: [] });
    const info = useFetch(Server.Url("/info")); // only to get the raw checks file path for info/display
    const [ groupBySchedule, setGroupBySchedule ] = useState(false);

    function findGroupWithFewestChecks(groups) {
        let group = null;
        for (let i = 0 ; i < groups?.length ; i++) {
            if (!group || (groups[i]?.checks?.length < group.checks.length)) {
                group = groups[i];
            }
        }
        return group;
    }
        
    const checks = useFetch({
        url: Server.Url("/checks/grouped/schedule", environ),
        nofetch: true,
        cache: true,
        onData: (data) => {
            data.sort((a,b) => a.group > b.group ? 1 : (a.group < b.group ? -1 : 0));
            if (data.length > 0) {
                //
                // Choose some group as default to show; choose the one with the fewest
                // checks just to minimize, by default, the number of API request.
                // Eventually cookie user with selected groups etc.
                //
                showGroup(findGroupWithFewestChecks(data), environ, groupList);
            }
            return data;
        }
    });

    const lambdas = useFetch({
        url: Server.Url("/lambdas", environ),
        cache: true,
        onData: (data) => {
            data.sort((a,b) => a.lambda_name > b.lambda_name ? 1 : (a.lambda_name < b.lambda_name ? -1 : 0));
            return data;
        }
    });

    useEffect(() => {

        refreshChecksStatus();
        checks.fetch(groupBySchedule ? Server.Url("/checks/grouped/schedule") : Server.Url("/checks/grouped"));

        // This running periodically screws up the check run configuration inputs.
        // setInterval(() =>  refreshChecksStatus(), 10000);

    }, [groupBySchedule]);

    const checksStatus = useFetch();

    function refreshChecksStatus() {
        checksStatus.refresh(Server.Url(`/checks_status`, environ));
    }

    function toggleShowGroup(group, env, groupList, historyList) {
        if (isSelectedGroup(group, groupList)) {
            hideGroup(group, groupList, historyList);
        }
        else {
            showGroup(group, env, groupList);
        }
    }

    function onGroupClick() {
        setGroupBySchedule(!groupBySchedule);
        groupList.update([]);
    }

    const ChecksGroupBox = ({props}) => {
        return <div style={{minWidth:"150pt"}}>
            <div style={{paddingBottom:"3pt",fontWeight:"bold"}}>
                { groupBySchedule ? <>
                    <div style={{display:"inline-block",marginTop:"-18pt"}}>Check Schedules</div>&nbsp;
                    <div style={{float:"right",borderRadius:"4pt",padding:"3pt",paddingTop:"2pt",marginRight:"8pt",marginTop:"-3pt",cursor:"pointer"}}
                        id="tooltip-view-group">
                        <img alt="group" src={Image.HierarchyIcon()} height="16" onClick={onGroupClick} />
                    </div>
                    <Tooltip id="tooltip-view-group" text="Click to view by check groups." position="top" />
                    <div style={{float:"right",borderRadius:"3pt",border:"1px solid black",background:"var(--box-bg-lighten)",padding:"3pt",paddingTop:"2pt",marginRight:"2pt",marginTop:"-2pt"}}
                        id="tooltip-viewing-schedule">
                        <img alt="group" src={Image.CalendarIcon()} height="15" />
                    </div>
                    <Tooltip id="tooltip-viewing-schedule" text="Viewing by check schedules." position="top" />
                </>:<>
                    Check Groups&nbsp;&nbsp;
                    <div id="tooltip-viewing-group" style={{float:"right",borderRadius:"3pt",border:"1px solid black",background:"var(--box-bg-lighten)",padding:"3pt",paddingTop:"2pt",marginRight:"6pt",marginTop:"-2pt"}}>
                        <img alt="group" src={Image.HierarchyIcon()} height="15" />
                    </div>
                    <Tooltip id="tooltip-viewing-group" text="Viewing by check groups." position="top" />
                    <div style={{float:"right",borderRadius:"4pt",padding:"3pt",paddingTop:"2pt",marginRight:"2pt",marginTop:"-3pt",cursor:"pointer"}} onClick={onGroupClick}
                        id="tooltip-view-schedule">
                        <img alt="group" src={Image.CalendarIcon()} height="16" />
                    </div>
                    <Tooltip id="tooltip-view-schedule" text="Click to view by check schedules." position="top" />
                </>}
            </div>
            <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"6pt"}}>
                { checks.map((datum, index) =>
                    <div key={datum.group}>
                        <span id={`tooltip-group-count-${index}`} style={{fontWeight:isSelectedGroup(datum, groupList) ? "bold" : "normal",cursor:"pointer"}} onClick={() => toggleShowGroup(datum, environ, groupList, historyList)}>
                            {datum.group.replace(/ checks$/i, "")} &nbsp;<small>({datum.checks.length})</small>
                        <Tooltip id={`tooltip-group-count-${index}`} text={`Checks: ${datum.checks?.length}`} position="right" shape="squared" />
                        </span>
                        { index < checks.length - 1 &&
                            <div className="fgbg" style={{marginTop:"3pt",marginBottom:"3pt",height:"1px"}} />
                        }
                    </div>
                )}
            </div>
        </div>
    }

    // TODO
    // Need to start figuring out how to factor out all of this stuff into sub-components.

    const checksRaw = useFetch(null);
    const [ checksRawHide, setChecksRawHide] = useState(false);

    function isShowingChecksRaw() {
        return !checksRaw.empty;
    }

    function showChecksRaw() {
        setChecksRawHide(false);
        checksRaw.fetch(Server.Url(`/checks_raw`), { cache: true });
    }

    function hideChecksRaw() {
        checksRaw.set(null);
        setChecksRawHide(true);
    }

    function toggleChecksRaw() {
        if (isShowingChecksRaw()) {
            hideChecksRaw();
        }
        else {
            showChecksRaw();
        }
    }

    const ChecksRawControl = () => {
        return <>
           &nbsp;<span style={{fontWeight:isShowingChecksRaw() ? "bold" : "normal"}} onClick={() => toggleChecksRaw()}>View Raw Checks</span> <br />
        </>
    }

    const [ showingChecksSearch, setShowingChecksSearch ] = useState(false);
    function toggleShowingChecksSearch() {
        setShowingChecksSearch(value => !value);
    }

    const ChecksRawView = ({ info }) => {
        return isShowingChecksRaw() && !checksRawHide && <>
            <b>Raw Checks</b> {Char.RightArrow} <span style={{fontSize:"9pt"}}>{info.get("checks.file")}</span>
            <div style={{marginTop:"3pt"}}>
            <pre className="box lighten" style={{maxWidth:"600pt"}}>
            { checksRaw.loading ? <>
                <StandardSpinner loading={checksRaw.loading} label={"Loading raw checks file"} size={60} color={"black"} />
            </>:<>
                <div style={{float:"right",marginTop:"-2pt"}}>
                    <span style={{fontSize:"0",opacity:"0"}} id={"checks_raw"}>{checksRaw.json()}</span>
                    <img alt="copy" onClick={() => Clipboard.Copy("checks_raw")} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                    &nbsp;<span style={{fontSize:"large",cursor:"pointer",color:"black"}} onClick={() => hideChecksRaw()}>X</span>
                </div>
                {checksRaw.yaml()}
            </>}
                    </pre>
            </div>
        </>
    }

    // Need to start figuring out how to factor out all of this stuff into sub-components.
    // Global most recent checks history.

    const recentRuns = useFetch(Server.Url("/checks/history/recent?limit=20", environ), { nofetch: true, cache: true });
    const [ recentRunsShow, setRecentRunsShow] = useState(false);

    function isShowingRecentRuns() {
        return !recentRuns.empty;
    }

    function showRecentRuns() {
        setRecentRunsShow(true);
        recentRuns.fetch();
    }

    function hideRecentRuns() {
        recentRuns.set(null);
        setRecentRunsShow(false);
    }

    function toggleRecentRuns() {
        if (isShowingRecentRuns()) {
            hideRecentRuns();
        }
        else {
            showRecentRuns();
        }
    }

    function findGroup(groupName) {
        return checks?.find(item => item.group === groupName);
    }

    function findCheck(checkName, groupName) {
        const group = findGroup(groupName)
        return group?.checks?.find(item => item.name === checkName);
    }

    const RecentRunsControl = () => {
        return <>
            &nbsp;<span style={{fontWeight:isShowingRecentRuns() ? "bold" : "normal"}} onClick={() => toggleRecentRuns()}>View Recent Runs</span>&nbsp;&nbsp;
            { recentRuns.loading && <><PuffSpinnerInline condition={true} size={"16px"}/></> }
        </>
    }

    const RecentRunsView = () => {
        const columns = [
            { label: "__refresh" },
            { label: "Timestamp", key: "timestamp" },
            { label: "Check", key: "check" },
            { label: "Status", key: "status" },
            { label: "Duration", key: "duration", align: "right" },
            { label: "State", key: "state" }
        ];
        if (recentRuns.error) {
            return <FetchErrorBox error={recentRuns.error} message="Error loading recent runs from Foursight API" />
        }
        if (recentRuns.length === 0) {
            return <>
                <b>Recent Runs</b>
                <div className="box" style={{paddingTop:"4pt",paddingBottom:"6pt",marginTop:"3pt",marginBottom:"8pt"}}>
                    No recent check runs found.
                </div>
            </>
        }
        return recentRunsShow && <>
            <b id="recent-runs-title">Recent Runs</b>
            <Tooltip id={"recent-runs-title"} text="Most recent runs across all checks." position="top" />
            <div className="box" style={{paddingTop:"4pt",paddingBottom:"6pt",marginTop:"3pt",marginBottom:"8pt",maxWidth:"700"}}>
                { (recentRuns.loading && recentRuns.null) ? <>
                    <StandardSpinner loading={recentRuns.loading} label={"Loading recent runs"} size={60} color={Styles.GetForegroundColor()} />
                </>:<>
                    { !recentRuns.empty && <small>
                        {/* TODO: Get this info from TableHead */}
                        { (recentRuns.data?.__sort?.key === "timestamp" && recentRuns.data?.__sort?.order === -1) ? <>
                            <b>Most Recent</b>:&nbsp;
                        </>:<>
                            <b>Top</b>:&nbsp;
                        </>}
                        <Duration.Live start={recentRuns?.data[0]?.timestamp} verbose={true} fallback={"just now"} suffix={"ago"} tooltip={true} />
                    </small>}
                    <b style={{float:"right",paddingBottom:"4pt",cursor:"pointer"}} onClick={hideRecentRuns}>{Char.X}</b>
                    <table style={{width:"100%"}} border="0">
                        <TableHead
                            columns={columns}
                            state={{key:"timestamp", order:-1}}
                            list={recentRuns.data}
                            update={() => recentRuns.update()}
                            refresh={() => recentRuns.refresh()}
                            style={{fontWeight:"bold"}}
                            lines={true}
                            loading={recentRuns.loading} />
                        <tbody>
                            { recentRuns.map((run, index) => <React.Fragment key={index}>
                                    
                                { index > 0 && <React.Fragment>
                                    <tr><td style={{paddingTop:"2px"}}></td></tr>
                                    <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                                </React.Fragment>}
                                <tr key={index} style={{verticalAlign:"top"}}>
                                    <td style={{width:"5%"}}>
                                        { run.status === "PASS" ?
                                            <span style={{color:Styles.GetForegroundColor()}}>{Char.Check}</span>
                                        :   <span style={{color:"darkred"}}>{Char.X}</span> }
                                    &nbsp;</td>
                                    <td  id={`recent-runs-timestamp ${index}`} style={{width:"20%"}}>
                                        {Date.Format(run.timestamp)} <br />
                                        <small>{Time.Format(run.timestamp)}</small>
                                        <Tooltip id={`recent-runs-timestamp ${index}`} text={Duration.Format(run.timestamp, DateTime.Now(), true, null, null, "agoy")} />
                                    &nbsp;&nbsp;</td>
                                    <td style={{width:"45%"}}>
                                        <b style={{cursor:"pointer"}} onClick={() => onClickShowHistory(findCheck(run.check, run.group), environ, historyList)}>{run.title}</b>
                                        &nbsp;&nbsp;<Link to={Client.Path(`/checks/${run.check}/history`)} rel="noreferrer" target="_blank">
                                            <small id={`tooltip-recent-runs-full-${index}`} className="fa fa-external-link" style={{color:"black",fontSize:"10pt",fontWeight:"default"}}></small>
                                            <Tooltip id={`tooltip-recent-runs-full-${index}`} text="Click for full history (in new tab)." position="bottom" />
                                        </Link>
                                        <br />
                                        <i><small style={{cursor:"pointer"}} onClick={() => toggleShowGroup(findGroup(run.group), environ, groupList, historyList)}>{run.group}</small></i>&nbsp;
                                    &nbsp;&nbsp;</td>
                                    <td style={{width:"10%"}}>&nbsp;
                                        <DisplayStatusText status={run.status} />
                                    &nbsp;&nbsp;</td>
                                    <td align="right" style={{width:"10%"}}>
                                        {run.duration}
                                    &nbsp;&nbsp;</td>
                                    <td style={{width:"10%"}}>
                                        { run.status === "PASS" && run.state === "Not queued" ? <>
                                            Done
                                        </>:<>
                                            {run.state}
                                        </>}
                                    &nbsp;&nbsp;</td>
                                </tr>
                            </React.Fragment>)}
                        </tbody>
                    </table>
                </>}
            </div>
        </>
    }

    const ChecksStatus = () => {
        return <>
            <table><tbody id={`tooltip-run-status`}><tr><td style={{whiteSpace:"nowrap",paddingBottom:"3pt"}}>
                <b style={{cursor:"pointer",marginBottom:"10pt"}} onClick={() => refreshChecksStatus()}>Checks Status</b>
                <Tooltip id={`tooltip-run-status`} text="Click to refresh current check run status." position="top" />
                &nbsp;&nbsp;
            </td><td>
            { checksStatus.loading ? <>
                { <StandardSpinner loading={checksStatus.loading} label={""} size={60} color={"black"} style={{paddingTop:"-2pt"}} /> }
            </>:<>
                <b style={{cursor:"pointer",fontSize:"small"}} onClick={() => refreshChecksStatus()}>{Char.Refresh}</b>
            </>}
            </td></tr></tbody></table>
            <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"6pt"}}>
                Running: {!checksStatus.loading ? checksStatus.get("checks_running") : "..."}
                <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:Styles.GetForegroundColor()}} />
                Queued: {!checksStatus.loading ? checksStatus.get("checks_queued") : "..."}
           </div>
        </>
    }

    function toggleLambdaView(lambda) {
        if (isShowingLambdaView(lambda)) {
            hideLambdaView(lambda);
        }
        else {
            showLambdaView(lambda);
        }
    }

    function isShowingLambdaView(lambda) {
        return lambda.__showing;
    }

    function showLambdaView(lambda) {
        lambda.__showing = true;
        lambdas.update();
    }

    function hideLambdaView(lambda) {
        lambda.__showing = false;
        lambdas.update();
    }

    // Since the /lambdas API doesn't filter by env name like the /checks
    // API does (perhaps it should, perhaps not), we need to check if the
    // check and its group associated with the lambda is actually in the
    // set of checks supported for the selected env.

    function getCheckGroup(groupName) {
        return checks?.find(check => check.group === groupName);
    }

    function getCheck(checkName, groupName) {
        const checkGroup = getCheckGroup(groupName);  
        return checkGroup && checkGroup?.checks?.find(check => check.name === checkName);
    }

    const LambdasPanel = ({props}) => {
        return <div style={{fontSize:"small"}}>
            <div style={{fontWeight:"bold",paddingBottom:"3pt"}}>Lambdas</div>
            <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                { lambdas.map((lambda, index) =>
                    <div key={lambda.lambda_name} title={lambda.lambda_function_name}>
                        <span onClick={() => toggleLambdaView(lambda)} style={{cursor:"pointer",fontWeight:isShowingLambdaView(lambda) ? "bold" : "default"}}>{lambda.lambda_name}</span>
                        { index < lambdas.length - 1 &&
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:Styles.GetForegroundColor()}} />
                        }
                    </div>
                )}
            </div>
        </div>
    }

    const LambdasView = () => {
        const lambdasShowing = lambdas?.filter((lambda) => isShowingLambdaView(lambda));
        if (Type.IsNonEmptyArray(lambdasShowing)) {
            return <div>
                <b>Lambdas</b>
                { lambdasShowing?.map(lambda =>
                     <LambdaView key={lambda.lambda_name} lambda={lambda} />
                )}
            </div>
        }
    }

    const LambdaView = ({lambda}) => {
        const tdContentStyle = { paddingRight: "4pt", verticalAlign: "top", fontSize: "small" };
        const tdLabelStyle = { ...tdContentStyle, width:"5%", whiteSpace: "nowrap", paddingRight: "4pt", verticalAlign: "top", textAlign:"right" };

        return <>
            <div className="box" style={{marginTop:"3pt",padding:"6pt",marginBottom:"6pt"}}>
                <b>{lambda.lambda_name}</b>
                <b style={{float:"right",cursor:"pointer"}} onClick={() => hideLambdaView(lambda)}>{Char.X}</b>
                <table style={{width:"100%"}}><tbody>
                    <tr><td colSpan="2" style={{height:"4pt"}}></td></tr>
                    <tr><td colSpan="2" style={{height:"1px",background:"gray"}}></td></tr>
                    <tr><td colSpan="2" style={{height:"4pt"}}></td></tr>
                    { (lambda.lambda_schedule) &&  <>
                        <tr>
                            <td style={tdLabelStyle}>Schedule:</td>
                            <td style={tdContentStyle}>
                                <i id={`tooltip-lambda-cron.${lambda.lambda_name}`} >{lambda.lambda_schedule_description}</i>
                                <Tooltip id={`tooltip-lambda-cron.${lambda.lambda_name}`} text={lambda.lambda_schedule} position="right" shape="squared" />
                            </td>
                        </tr>
                        <tr><td colSpan="2" style={{height:"4pt"}}></td></tr>
                        <tr><td colSpan="2" style={{height:"1px",background:"gray"}}></td></tr>
                        <tr><td colSpan="2" style={{height:"4pt"}}></td></tr>
                    </>}
                    <tr>
                        <td style={tdLabelStyle}>Handler:</td>
                        <td style={tdContentStyle}>
                            <span id={`tooltip-lambda-arn-${lambda.lambda_name}`}>{lambda.lambda_handler}</span> <br />
                            <Tooltip id={`tooltip-lambda-arn-${lambda.lambda_name}`} text={`ARN: ${lambda.lambda_function_arn}`} position="top" />
                            <small><a href={`https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/${lambda.lambda_function_name}?tab=code`} rel="noreferrer" target="_blank">{lambda.lambda_function_name}</a></small>
                        </td>
                    </tr>
                    <tr>
                        <td style={tdLabelStyle}><small>Role:</small></td>
                        <td style={tdContentStyle}>
                            <small id={`tooltip-lambda-role-arn-${lambda.lambda_role}`}><a href={`https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/roles/details/${lambda.lambda_role?.replace(/.*\//,'')}`} rel="noreferrer" target="_blank">{lambda.lambda_role?.replace(/.*\//,'')}</a></small>
                            <Tooltip id={`tooltip-lambda-role-arn-${lambda.lambda_role}`} text={`Role ARN: ${lambda.lambda_role}`} position="bottom" />
                        </td>
                    </tr>
                    <tr>
                        <td style={tdLabelStyle}>Updated:</td>
                        <td style={tdContentStyle}><span id={`tooltip-lambda-updated-${lambda.lambda_name}`}>{DateTime.Format(lambda.lambda_modified)}</span></td>
                        <Tooltip id={`tooltip-lambda-updated-${lambda.lambda_name}`} text={Time.Ago(lambda.lambda_modified)} position="right" shape="squared" />
                    </tr>
                    <tr style={{fontSize:"small"}}>
                        <td style={tdLabelStyle}>Code:</td>
                        <td style={tdContentStyle}>
                            <a id={`tooltip-lambda-s3-${lambda.lambda_name}`} href={`https://s3.console.aws.amazon.com/s3/object/${lambda.lambda_code_s3_bucket}?region=us-east-1&prefix=${lambda.lambda_code_s3_bucket_key}`} rel="noreferrer" target="_blank">{lambda.lambda_code_s3_bucket_key}</a> <br />
                            <small><a href={`https://s3.console.aws.amazon.com/s3/buckets/${lambda.lambda_code_s3_bucket}?region=us-east-1&tab=objects`} rel="noreferrer" target="_blank">{lambda.lambda_code_s3_bucket}</a></small>
                            <Tooltip id={`tooltip-lambda-s3-${lambda.lambda_name}`} text={"Click to view code location in AWS S3 (in new tab)."} position="bottom" />
                        </td>
                    </tr>
                    <tr>
                        <td style={tdLabelStyle}>Code Size:</td>
                        <td style={tdContentStyle}><span id={`tooltip-lambda-size-${lambda.lambda_name}`}>{Str.FormatBytes(lambda.lambda_code_size)}</span></td>
                       <Tooltip id={`tooltip-lambda-size-${lambda.lambda_name}`} text={`Code size in bytes: ${lambda.lambda_code_size}`} position="right" shape="squared" />
                    </tr>
                    { (lambda?.lambda_checks && lambda?.lambda_checks?.length > 0) && <>
                        <tr><td colSpan="2" style={{height:"4pt"}}></td></tr>
                        <tr><td colSpan="2" style={{height:"1px",background:"gray"}}></td></tr>
                        <tr><td colSpan="2" style={{height:"4pt"}}></td></tr>
                        <tr>
                            <td style={tdLabelStyle}>Checks:</td>
                            <td style={tdContentStyle}>
                                <table border="0"><tbody>
                                    { lambda.lambda_checks?.map((lambda_check) =>
                                        <tr key={lambda_check.check_name}>
                                            <td style={{...tdContentStyle}}>
                                                { (getCheck(lambda_check.check_name, lambda_check.check_group)) ? <>
                                                    <b id={`tooltip-lambda-check-${lambda_check.check_name}`} style={{color:Styles.GetForegroundColor(),cursor:"pointer"}} onClick={() => onClickShowHistory(findCheck(lambda_check.check_name, lambda_check.check_group), environ, historyList)}>{lambda_check.check_title}</b> <br />
                                                    <i id={`tooltip-lambda-check-group-${lambda_check.check_name}`} style={{color:Styles.GetForegroundColor(),cursor:"pointer"}} onClick={() => toggleShowGroup(findGroup(lambda_check.check_group), environ, groupList, historyList)}>{lambda_check.check_group}</i>
                                                </>:<>
                                                    <b style={{color:"#444444"}}>{lambda_check.check_title}</b> <br />
                                                    <i style={{color:"#444444"}}>{lambda_check.check_group}</i>
                                                </>}
                                            </td>
                                            <Tooltip id={`tooltip-lambda-check-${lambda_check.check_name}`} text={`Check: ${lambda_check.check_name}.`} position="bottom" />
                                            <Tooltip id={`tooltip-lambda-check-group-${lambda_check.check_name}`} text={`Check Group: ${lambda_check.check_group}.`} position="bottom" />
                                        </tr>
                                    )}
                                </tbody></table>
                            </td>
                        </tr>
                    </>}
                </tbody></table>
            </div>
        </>
    }

    if (checks.error) return <FetchErrorBox error={checks.error} message="Error loading checks from Foursight API" />
    if (checks.loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={checks.loading} color={Styles.GetForegroundColor()} size={90} />
            </div>
        </>
    }
    return <>
        <ChecksValidation />
        <div>
            <table><tbody>
                <tr>
                    <td style={{paddingLeft:"4pt",verticalAlign:"top"}}>
                        <ChecksGroupBox />
                        <div className="box thickborder check-pass padding-small cursor-hand" style={{marginBottom:"8pt"}}>
                            <RecentRunsControl />
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"var(--box-fg)"}} />
                            <ChecksRawControl />
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"var(--box-fg)"}} />
                            <ChecksSearchControl showingChecksSearch={showingChecksSearch} toggleShowingChecksSearch={toggleShowingChecksSearch} />
                        </div>
                        <ChecksStatus />
                        <LambdasPanel />
                    </td>
                    <td style={{paddingLeft:"8pt",verticalAlign:"top"}}>
                        <ChecksRawView info={info} />
                        <SelectedGroupsPanel
                            env={environ}
                            groupList={groupList}
                            historyList={historyList}
                            info={info}
                            toggleShowingChecksSearch={toggleShowingChecksSearch} />
                    </td>
                    <td style={{paddingLeft: (groupList?.length > 0 || groupList.error || isShowingChecksRaw()) ? "8pt" : "0",verticalAlign:"top"}}>
                        <ChecksSearchBox
                            checks={checks}
                            groupList={groupList}
                            environ={environ}
                            findGroup={findGroup}
                            toggleShowGroup={toggleShowGroup}
                            showingChecksSearch={showingChecksSearch}
                            toggleShowingChecksSearch={toggleShowingChecksSearch} />
                        <LambdasView />
                        <RecentRunsView />
                        <ResultsHistoryPanel env={environ} historyList={historyList} />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
}

// This is outside because finally starting to factor out into independent components.
const RunActionBox = ({ check, env, groupList, fetchResult, runActionAllowedState }) => {

    const [ runActionConfirm, setRunActionConfirm ] = useState(false);
    const [ readOnlyMode ] = useReadOnlyMode();
    const fetch = useFetchFunction();

    useEffect(() => {
        setRunActionConfirm(false);
    }, []);

    function onClickRunAction() {
        if (runActionConfirm) {
            // 
            // TODO
            //
            setRunActionConfirm(false);
            const action = check.__result?.get("action")
            if (action) {
                doRunAction(check, action, env, groupList, fetch);
                //
                // Disable Run Action button right after run action.
                //
                runActionAllowedState[1](false);
            }
        }
        else {
            setRunActionConfirm(true);
        }
    }

    function onClickRunActionCancel() {
        setRunActionConfirm(false);
    }

    return <>
        { check.__configuringCheckRun && check.__result?.get("action") && <>
            <div className="box thickborder" style={{background:"lightyellow",fontSize:"small",marginTop:"4pt",paddingTop:"8pt",paddingBottom:"8pt"}}>
                <div style={{marginTop:"0pt"}}>
                    <b><u>Action</u></b>:&nbsp;
                    <span style={{color:runActionConfirm ? "red" : "inherit",fontWeight:runActionConfirm ?  "bold" : "inherit"}}>
                        <b id={`tooltip-view-action-${check.name}`} >{check.__result.get("action_title")}</b>
                        { check.registered_action.github_url && <>
                            <a id={`tooltip-view-action-source-${check.name}`} style={{marginLeft:"6pt"}} rel="noreferrer" target="_blank" href={check.registered_action.github_url}><img alt="github" src={Image.GitHubLoginLogo()} height="16"/></a>
                            <Tooltip id={`tooltip-view-action-source-${check.name}`} text="Click to view source code for this action (in new tab)." />
                        </>}
                    </span>
                    <Tooltip id={`tooltip-view-action-${check.name}`} text={`Action: ${check.name}. Module: ${check.module}`} position="bottom" />
                    <div style={{float:"right",marginTop:"-2pt"}}>
                        {(runActionAllowedState[0] && !readOnlyMode) ?<>
                            { runActionConfirm ? <>
                                <span className="check-action-confirm-button" style={{float:"right"}} onClick={onClickRunActionCancel}>&nbsp;<b>Cancel</b></span>
                            </>:<>
                                <button className="check-run-button" onClick={onClickRunAction}> Run Action <b>...</b></button>
                            </>}
                        </>:<>
                            { !readOnlyMode ? <>
                                <button className="check-run-button disabled" style={{cursor:"not-allowed"}} disabled={true}>Run Action Disallowed</button>
                            </>:<>
                                <button className="check-run-button disabled" style={{cursor:"not-allowed"}} disabled={true}>Run Action Disabled</button>
                            </>}
                        </>}
                    </div>
                    { (!readOnlyMode && !runActionAllowedState[0] && !check.__result.loading && !check.__resultByUuid.loading && !check.__resultByAction.loading) && <>
                        <div id={`tooltip-result-refresh-${check.name}`} style={{float:"right",marginRight:"8pt",marginTop:"0pt",cursor:"pointer",color:"black"}} onClick={() => fetchResult(check, env, groupList, true)}>
                            <div style={{display:"inline-block",fontWeight:"bold",fontSize:"large",marginTop:"-2pt"}}>{Char.Refresh}</div>
                        </div>
                        <Tooltip id={`tooltip-result-refresh-${check.name}`} text="Click to refresh latest result." position="bottom" />
                    </>}
                </div>
                { runActionConfirm && <>
                    <div style={{borderTop:"1px solid",marginTop:"8pt",marginBottom:"8pt"}}/>
                    <b style={{color:"red"}}>{Char.RightArrow}&nbsp;<i>Are you sure you want to run this action?</i></b>
                    <span id={`tooltip-action-run-${check.name}`} style={{float:"right",marginTop:"-3pt"}}>
                        <button className="check-run-button red" onClick={onClickRunAction}>{Char.RightArrowFat} Run Action</button>
                    </span>
                    <Tooltip id={`tooltip-action-run-${check.name}`} text="Click to actually run this action." position="top" />
                </>}
            </div>
        </>}
    </>
}

export default ChecksPage;
