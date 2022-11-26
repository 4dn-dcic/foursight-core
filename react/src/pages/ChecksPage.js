import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Uuid from 'react-uuid';
import { RingSpinner, PuffSpinnerInline, StandardSpinner } from '../Spinners';
import { useReadOnlyMode } from '../ReadOnlyMode';
import { useFetch, useFetchFunction } from '../utils/Fetch';
import { FetchErrorBox } from '../Components';
import Char from '../utils/Char';
import Clipboard from '../utils/Clipboard';
import Client from '../utils/Client';
import Env from '../utils/Env';
import Image from '../utils/Image';
import Json from '../utils/Json';
import Server from '../utils/Server';
import Str from '../utils/Str';
import TableHead from '../TableHead';
import Time from '../utils/Time';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';
import LiveTime from '../LiveTime';
import Styles from '../Styles';

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
        //group.checks.map(check => showResultBox(check, env, groupList)); // xyzzy this is suspect
        //group.checks.map(check => { console.log(`xyzzy/showResultBox(${check.name})`); showResultBox(check, env, groupList); } ); // xyzzy this is suspect
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
            // selectedHistories.unshift(check);
            // noteChangedHistories();
            historyList.prepend(check);
            if (!check.history) {
                historyList.refresh({
                    url: Server.Url(`/checks/${check.name}/history`, env),
                    onData: (data, current) => {
                        check.history = data;
                        return current;
                    }
                });
            }
        }
    }

    function fetchHistory(check, env, historyList) {
        historyList.refresh({
            url: Server.Url(`/checks/${check.name}/history`, env),
            onData: (data, current) => {
                check.history = data;
                return current;
            }
        });
    }

    function runCheck(check, env, groupList, historyList, fetch) {
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
                    refreshHistory(check, env, historyList);
                    noteChangedCheckBox(groupList);
                }, 4 * 1000);
                return data.uuid;
            }
        });
        check.__queuedCheckRun = null;
        showCheckRunningBox(check, groupList);
        showHistory(check, env, historyList);
    }

    function refreshHistory(check, env, historyList) {
        check.history = null;
        if (check.__showingHistory) {
            hideHistory(check, historyList);
            showHistory(check, env, historyList);
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

    // xyzzy

    const SelectedGroupsPanel = ({ groupList, env, historyList, info }) => {

        if (groupList.error) return <FetchErrorBox error={groupList.error} message="Error loading checks from Foursight API" />
        return <div>
            { groupList.length > 0 /* selectedGroups.length > 0 */ ? (<>
                <div style={{paddingBottom:"3pt"}}><b>Checks</b></div>
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
            <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"4pt",minWidth:"300pt"}}>
                <div>
                    <span style={{cursor:"pointer"}} onClick={() => toggleShowAllResults(group?.checks, groupList)}><b>{group?.group}</b> {isShowingAnyResults(group?.checks) ? (<small>{Char.DownArrowFat}</small>) : (<small>{Char.UpArrowFat}</small>)}</span>
                    <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideGroup(group, groupList, historyList)})}><b>{Char.X}</b></span>
                </div>
                <div style={{marginTop:"6pt"}} />
                { group?.checks?.map((check, index) =>
                    <div key={index}>
                        { index > 0 && <div style={{marginBottom:"12px"}} /> }
                        <SelectedGroupCheckBox check={check} env={env} groupList={groupList} historyList={historyList} info={info} />
                    </div>
                )}
            </div>
        </div>
    }

    const SelectedGroupCheckBox = ({check, env, groupList, historyList, info }) => {

        function toggleCheckResultsBox(check, env, groupList) {
            if (check.__showingResults) {
                hideResultBox(check, groupList);
            }
            else {
                showResultBox(check, env, groupList);
            }
        }
        //useEffect(() => {
                //console.log(`.......................................:${check.name}`)
                //check.__showingResults = true;
        //}, [check]);

        return <div>
            <div className="box check-box" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"450pt"}}>
            <table style={{width:"100%"}}>
                <tbody>
                    <tr style={{height:"3pt"}}><td></td></tr>
                    <tr>
                        <td style={{verticalAlign:"top",width:"1%","cursor":"pointer"}} onClick={() => {toggleCheckResultsBox(check, env, groupList)}}>
                            <b>{ isShowingSelectedCheckResultsBox(check) ? <small>{Char.DownArrowHollow}</small> : <small>{Char.RightArrowHollow}</small> }&nbsp;</b>
                        </td>
                        <td style={{veriticalAlign:"top",maxWidth:"600pt",width:"100%"}}>
                            { (!check.__configuringCheckRun) ? <>
                                <RunButton check={check} env={env} groupList={groupList} historyList={historyList} style={{marginLeft:"30pt",marginTop:"-3pt",float:"right"}} />
                            </>:<>
                                { (check.__queueingCheckRun) ? <>
                                    <div className={"check-config-wait-button"} style={{float:"right"}}>
                                        <span className={"tool-tip"} data-text={"Configure run below."} style={{}}><span style={{fontSize:"small"}}>{Char.DownArrowFat}</span>&nbsp;Configure</span>
                                    </div>
                                </>:<>
                                    <div
                                        className={check.__configuringCheckRun ? "check-config-button" : "check-run-button"} style={{float:"right"}}
                                        onClick={() => {
                                            if (check.__configuringCheckRun) {
                                                saveInputKwargs(check);
                                                check.__configuringCheckRun = false;
                                            }
                                            else {
                                                check.__configuringCheckRun = true;
                                            }
                                            noteChangedCheckBox(groupList);
                                        }}>
                                        <span
                                            className={"tool-tip"}
                                            data-text={"Configure run below."}
                                            style={{}}>
                                            <span style={{fontSize:"small"}}>{Char.DownArrowFat}</span>&nbsp;Configure
                                        </span>
                                    </div>
                                </>}
                            </>}
                            <u className="tool-tip" data-text={`Check: ${check.name}. Module: ${check.module}. File: ${check.file}`} style={{cursor:"pointer",fontWeight:isShowingSelectedCheckResultsBox(check) ? "bold" : "normal"}} onClick={() => {onClickShowHistory(check, env, historyList);}}>{check.title}</u>
                            { check.registered_github_url && <>
                                <a className="tool-tip" data-text="Click here to view the source code for this check." style={{marginLeft:"6pt",marginRight:"6pt"}} rel="noreferrer" target="_blank" href={check.registered_github_url}><img alt="github" src={Image.GitHubLoginLogo()} height="18"/></a>
                            </>}
                            <ToggleHistoryButton check={check} env={env} historyList={historyList} />
                            {/* <RefreshResultButton check={check} style={{marginLeft:"10pt"}} /> */}
                            {/* TODO: As far as I can tell there is only every one element here under the schedule element */}
                            { Object.keys(check?.schedule).map((key, index) =>
                                <div key={key}>
                                    { Str.HasValue(check.schedule[key]?.cron_description) ? (
                                        <div style={{whiteSpace:"nowrap",width:"100%"}} key={index} title={check.schedule[key].cron}>
                                            <small><i>Schedule: <span className={"tool-tip"} data-text={check.schedule[key]?.cron}>{check.schedule[key].cron_description}</span>.</i></small>
                                        </div>
                                    ):(
                                        <small><i>
                                            Not scheduled.
                                        </i></small>
                                    )}
                                </div>
                            )}
                            <CheckRunArgsBox check={check} env={env} groupList={groupList} historyList={historyList} update={() => noteChangedCheckBox(groupList)}/>
                            {/* ACTION BEGIN */}
                            <RunActionBox check={check} update={() => groupList.update()} />
                            {/* ACTION END */}
                            <>
                                { isShowingSelectedCheckResultsBox(check) && (<>
                                    <SelectedCheckResultsBox check={check} env={env} groupList={groupList} info={info} />
                                </>)}
                            </>
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
            <span data-text={"Click here to " + (check.__showingHistory ? "hide" : "show") + " recent history of check runs."} className={"tool-tip"}>
                <img alt="history" onClick={(e) => {}} src={Image.History()} style={{marginBottom:"1px",marginRight:"2pt",height:"18"}} />
            </span>
            { check.__showingHistory ? <span>{Char.RightArrow}</span> : <></> }
        </span>
    }

    const SelectedCheckResultsBox = ({ check, env, groupList, info }) => {
        return <div>
            {/* Check manually queued box */}
            <CheckRunningBox check={check} groupList={groupList} info={info} />
            {/* Schedule(s) and latest run lines */}
            <ResultBox check={check} env={env} groupList={groupList} />
        </div>
    }

    const ResultBox = ({ check, env, groupList }) => {

        const [showResultByUuid, setShowResultByUuid ] = useState(false);

        check.__result = useFetch(Server.Url(`/checks/${check.name}`, env), { nofetch: true });
        check.__resultByUuid = useFetch();

        useEffect(() => {
            check.__result.fetch();
        }, [check]);

        function onClickResultByUuid(check, groupList) {
            //check.__showingResultDetails = true;
            //noteChangedResults(groupList)
            if (check.__resultByUuid.empty) {
                fetchResultByUuid(check, groupList);
            }
            setShowResultByUuid(true); 
        }

        function fetchResultByUuid(check, groupList) {
            if (check.__result.get("uuid")) {
                check.__resultByUuid.refresh({
                    url: Server.Url(`/checks/${check.name}/${check.__result.get("uuid")}`),
                    onData: () => { noteChangedResults(groupList); }
                });
            }
        }

        function onClickResultSummary(check) {
            if (check.__result.empty) {
                check.__result.refresh();
            }
            setShowResultByUuid(false);
        }

        function onClickResult(check, groupList) {
            check.__showingResultDetails = !check.__showingResultDetails;
            noteChangedResults(groupList);
        }

        function refreshResults(check, env, groupList) {
            if (showResultByUuid) {
                fetchResultByUuid(check, groupList);
            }
            else {
                check.__result.refresh();
            }
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
                    tooltip = "Fetching latest result summary.";
                }
                else {
                    tooltip = "Click to fetch latest result summary";
                }
            }
            return <span style={{cursor:"pointer",color:"inherit",fontSize:"10pt",paddingBottom:"11pt"}} onClick={(e) => { refreshResults(check, env, groupList); }}>
                <b className="tool-tip" data-text={tooltip}>{Char.Refresh}</b>
            </span>
        }

        return <div>
            { !check.__result.loading && <small style={{color:check.__result.get("status")?.toUpperCase() === "PASS" ? "inherit" : "darkred",cursor:"pointer"}}>
                { !check.__result.empty ? (<>
                    { <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div> }
                    <span onClick={() => onClickResult(check, groupList)}><span className="tool-tip" data-text={Time.FormatDuration(check.__result.get("timestamp"), new Date(), true, null, null, "ago")}>
                        <b>Latest Result</b></span>
                        { check.__showingResultDetails ? (
                            <b className={"tool-tip"} data-text={"Click to hide result details."}>&nbsp;{Char.DownArrow}</b>
                        ):(
                            <b className={"tool-tip"} data-text={"Click to show result details."}>&nbsp;{Char.UpArrow}</b>
                        )}&nbsp;
                        {check.__result.get("timestamp")}
                    </span>
                    { check.__showingResultDetails && <>
                        { check.__result.get("uuid") ? <>
                            { showResultByUuid ? <>
                                &nbsp;|&nbsp;<span onClick={() => onClickResultSummary(check)}>Summary</span>
                                &nbsp;|&nbsp;<b>Check</b>
                            </>:<>
                                &nbsp;|&nbsp;<b>Summary</b>
                                &nbsp;|&nbsp;<span onClick={() => onClickResultByUuid(check, groupList)}>Check</span>
                            </>}
                        </>:<>
                            &nbsp;|&nbsp;<b>Summary</b>
                        </>}
                    </>}
                    &nbsp;|&nbsp;<RefreshResultButton check={check} env={env} groupList={groupList} />
                    <br />
                    <span style={{color:check.__result.get("status")?.toUpperCase() === "PASS" ? "inherit" : "darkred"}} onClick={() => onClickResult(check, groupList)}>
                        <span className={"tool-tip"} data-text={"Click to " + (check.__showingResultDetails ? "hide" : "show") + " result details."}>Results Summary</span>:&nbsp;
                        {check.__result.get("summary")}&nbsp;&nbsp;
                        {check.__result.get("status")?.toUpperCase() === "PASS" ? (<b style={{fontSize:"12pt",color:"inherit"}}>{Char.Check}</b>) : (<b style={{fontSize:"13pt",color:"darkred"}}>{Char.X}</b>)}
                    </span>
                </>):(<>
                    { !check.__showingResultDetails && <>
                        <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div>
                        <span>No recent result</span>&nbsp;|&nbsp;<RefreshResultButton check={check} env={env} groupList={groupList} />
                    </>}
                </>)}
            </small> }
            {/* Results details or loading result box */}
            { check.__showingResultDetails ? <>
                <div style={{height:"2pt"}} />
                <ResultDetailsBox check={check} groupList={groupList} showResultByUuid={showResultByUuid} />
            </>:<>
                { check.__result.loading && <>
                    <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div>
                    <StandardSpinner condition={check.__result.loading} color={Styles.GetForegroundColor()} label={"Loading latest result"} />
                </>}
            </>}
        </div>
    }

    const ResultDetailsBox = ({check, groupList, showResultByUuid, style}) => {
        if (showResultByUuid) {
            return <pre className="box lighten" style={{wordWrap:"break-word",paddingBottom:"4pt",marginBottom:"3px",marginTop:"3px",marginRight:"5pt",minWidth:"360pt",maxWidth:"100%"}}>
                <div style={{float:"right",marginTop:"0px"}}>
                    <span style={{fontSize:"0",opacity:"0"}} id={check.name}>{Json.Str(check.__resultByUuid.get())}</span>
                    <img alt="copy" onClick={() => Clipboard.Copy(check.name)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                    &nbsp;<span style={{fontSize:"large",cursor:"pointer",color:"black"}} onClick={() => { check.__showingResultDetails = false ; noteChangedResults(groupList); }}>X</span>
                </div>
                { check.__resultByUuid.loading ? <>
                    <StandardSpinner condition={check.__resultByUuid?.loading} color={Styles.GetForegroundColor()} label={"Loading latest result"} />
                </>:<>{Yaml.Format(check.__resultByUuid.get())}</>}
            </pre>
        }
        return <pre className="box lighten" style={{color:check.__result.get("status")?.toUpperCase() === "PASS" ? "inherit" : "darkred",wordWrap:"break-word",paddingBottom:"4pt",marginBottom:"3px",marginTop:"3px",marginRight:"5pt",minWidth:"360pt",maxWidth:"100%"}}>
            <div style={{float:"right",marginTop:"-10px"}}>
            <span style={{fontSize:"0",opacity:"0"}} id={check.name}>{Json.Str(check.showingResultDetailsFull ? check.__result.get("full_output") : check.__result.get())}</span>
            <img alt="copy" onClick={() => Clipboard.Copy(check.name)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
            &nbsp;<span style={{fontSize:"x-large",cursor:"pointer",color:"black"}} onClick={() => {check.showingResultDetailsFull = !check.showingResultDetailsFull; noteChangedResults(groupList); } }>{check.showingResultDetailsFull ? <span title="Show full result output.">{Char.UpArrow}</span> : <span>{Char.DownArrow}</span>}</span>
            &nbsp;<span style={{fontSize:"large",cursor:"pointer",color:"black"}} onClick={() => { check.__showingResultDetails = false ; noteChangedResults(groupList); }}>X</span>
            </div>
            { check.__result.loading ?
                <StandardSpinner condition={check.__result.loading} color={Styles.GetForegroundColor()} label={"Loading latest result summary"}/>
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
                <span
                 className={"tool-tip"}
                 data-text={"Wait until " + (check.__queueingCheckRun ? "check queueing" : "result fetch") + " completes."}>
                     <i>Queueing</i>
                 </span>
            </div>
        }
        return <div>
            <div className={"check-run-button"} style={{...style, cursor:readOnlyMode && check.__configuringCheckRun ? "not-allowed" : "",background:readOnlyMode && check.__configuringCheckRun ? "#888888" : "",color:check.__configuringCheckRun ? "yellow" : ""}}
                onClick={(e) => {
                    if (check.__configuringCheckRun) {
                        if (!readOnlyMode) {
                            saveInputKwargs(check);
                            // showResultBox(check, env, groupList);
                            runCheck(check, env, groupList, historyList, fetch);
                        }
                    }
                    else {
                        check.__configuringCheckRun = true;
                        // showResultBox(check, env, groupList);
                        noteChangedCheckBox(groupList);
                    }
                }}>
                <span className={"tool-tip"} data-text={readOnlyMode ? "Run disabled because in readonly mode." : "Click to run this check."}>
                    { !readOnlyMode ? <>
                        { check.__configuringCheckRun ? <>
                            <span style={{fontSize:"small"}}>{Char.RightArrowFat}</span>&nbsp;<span>Run</span>
                        </>:<>
                            <span style={{fontSize:"small"}}></span>&nbsp;<span>Run ...</span>
                        </>}
                    </>:<>
                        { check.__configuringCheckRun ? <>
                            <span style={{fontSize:"",color:"#DDDDDD",background:"#888888"}}><small>&nbsp;</small>Disabled</span>
                        </>:<>
                            <span style={{fontSize:"small"}}></span>&nbsp;<span>Run ...</span>
                        </>}
                    </>}
                </span>
            </div>
        </div>
    }

    // What a pain ...
    const CheckRunArgsBox = ({ check, env, groupList, historyList, update }) => {

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

        if (!Type.IsNonEmptyObject(check.kwargs)) {
            check.kwargs = getKwargsFromCheck(check);
        }
        return check.__configuringCheckRun && <>
            <div className="box thickborder" style={{marginTop:"4pt",padding:"6pt",cursor:"default",background:"lightyellow"}} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                { (Type.IsNonEmptyObject(check.kwargs)) ? (<>
                    <div style={{marginTop:"-2pt",float:"right"}}>
                        <RunButton check={check} env={env} groupList={groupList} historyList={historyList} style={{float:"right"}} />
                    </div>
                    <table style={{fontSize:"small",marginTop:"0pt"}}><tbody>
                    { Object.keys(check.kwargs).sort().map(key =>
                        <tr key={Uuid()} style={{}}>
                            <td align="top">
                                <b>{key}</b>:
                            &nbsp;&nbsp;</td>
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
        return !check.showingCheckRunningBox ? <span /> : <div>
            {/* <div className="box" style={{marginTop:"4pt",padding:"6pt",cursor:"default",borderColor:"red",background:"yellow",filter:"brightness(0.9)"}} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}> */}
            <div className="box" style={{marginTop:"4pt",padding:"6pt",cursor:"default",borderColor:"red",background:"yellow",filter:"brightness(0.9)"}}>
                { !check.__queueingCheckRun && <span style={{float:"right",cursor:"pointer"}} onClick={(e) => { hideCheckRunningBox(check, groupList);e.stopPropagation(); e.preventDefault(); }}></span> }
                {  check.__queuedCheckRun &&
                    <small><b>
                        <span className="tool-tip" data-text="Click to view UUID for this run." onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>Queued check run</span>:&nbsp;
                        <span onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>{Time.FormatDateTime(check.__queuedCheckRun + "+00:00")}</span>
                        &nbsp;{Char.RightArrow}&nbsp;
                                
                        { showUuid ? <>
                            <a className="tool-tip" data-text="Click to view in AWS S3." rel="noreferrer" target="_blank" onClick={(e) => {}} href={`https://s3.console.aws.amazon.com/s3/object/${info.get("checks.bucket")}?region=us-east-1&prefix=${check.name}/${check.__queuedCheckRun}.json`} style={{color:"inherit"}}><u>{check.__queuedCheckRun}</u></a>
                        </>:<>
                            <span className="tool-tip" data-text={`UUID: ${check.__queuedCheckRun}`} onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>OK</span>
                        </>}
                        <div style={{float:"right",marginTop:"-0pt",cursor:"pointer"}} onClick={() => {hideCheckRunningBox(check, groupList); }}>&nbsp;{Char.X}</div>
                    </b></small>
                }
                { !check.__queuedCheckRun && <div style={{marginTop:"-2pt"}}><StandardSpinner condition={check.__queueingCheckRun} label={" Queueing check run"} color={"darkred"} /></div> }
            </div>
        </div>
    } 


const ChecksPage = (props) => {

    // TODO: Lotsa refactoring ...

    let { environ } = useParams();
    const historyList = useFetch({ initial: [] });
    const groupList = useFetch({ initial: [] });
    const info = useFetch(Server.Url("/info")); // only to get the raw checks file path for info/display
        
    const checks = useFetch({
        url: Server.Url("/checks", environ),
        onData: (data) => {
            data.sort((a,b) => a.group > b.group ? 1 : (a.group < b.group ? -1 : 0));
            if (data.length > 0) {
                //
                // Choose some group as default to show.
                //
                let group = data.find(item => item.group.toLowerCase().includes("clean"));
                //if (!group) group = data[0];
                if (!group) group = data[4];
                showGroup(group, environ, groupList);
            }
            return data;
        }
    });
    const lambdas = useFetch({
        url: Server.Url("/lambdas", environ),
        onData: (data) => {
            data.sort((a,b) => a.lambda_name > b.lambda_name ? 1 : (a.lambda_name < b.lambda_name ? -1 : 0));
            return data;
        }
    });

    useEffect(() => {

        refreshChecksStatus();

        // This running periodically screws up the check run configuration inputs.
        // setInterval(() =>  refreshChecksStatus(), 10000);

    }, []);

    const checksStatus = useFetch();
    function refreshChecksStatus() {
        checksStatus.refresh(Server.Url(`/checks-status`, environ));
    }

    function toggleShowGroup(group, env, groupList, historyList) {
        if (isSelectedGroup(group, groupList)) {
            hideGroup(group, groupList, historyList);
        }
        else {
            showGroup(group, env, groupList);
        }
    }

    function onGroupSelectAll(group) {
        if (checks.length === groupList.length) {
            groupList.update([]);
        }
        else {
            groupList.update([...checks.data]);
        }
    }

    const ChecksGroupBox = ({props}) => {
        return <div style={{minWidth:"150pt"}}>
            <div style={{fontWeight:"bold",paddingBottom:"3pt",cursor:"pointer"}} onClick={() => onGroupSelectAll()}>Check Groups</div>
            <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"6pt"}}>
                { checks.map((datum, index) =>
                    <div key={datum.group}>
                        <span style={{fontWeight:isSelectedGroup(datum, groupList) ? "bold" : "normal",cursor:"pointer"}} onClick={() => toggleShowGroup(datum, environ, groupList, historyList)}>
                            {datum.group}
                        </span>
                        { index < checks.length - 1 &&
                            <div className="fgbg" style={{marginTop:"3pt",marginBottom:"3pt",height:"1px"}} />
                        }
                    </div>
                )}
            </div>
        </div>
    }

    const ResultsHistoryBox = ({ check, env }) => {

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

        return <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"8pt"}}>
            <div title={check.name}>
                <b className="tool-tip" data-text={`Check: ${check.name}. Module: ${check.module}. Group: ${check.group}. Click for full history.`}>
                    <Link to={Client.Path(`/checks/${check.name}/history`)} style={{color:"inherit"}} rel="noreferrer" target="_blank">{check.title}</Link>
                </b>&nbsp;
                { check.registered_github_url && <>
                    <a className="tool-tip" data-text="Click here to view the source code for this check." style={{marginLeft:"4pt",marginRight:"6pt"}} rel="noreferrer" target="_blank" href={check.registered_github_url}><img alt="github" src={Image.GitHubLoginLogo()} height="18"/></a>
                </>}
                <Link to={Client.Path(`/checks/${check.name}/history`)} className={"tool-tip"} data-text={"Click for full history."} rel="noreferrer" target="_blank"><img alt="history" src={Image.History()} style={{marginBottom:"1px",height:"18"}} /></Link>
                <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideHistory(check, historyList)})}>&nbsp;&nbsp;<b>{Char.X}</b></span>
            </div>
            <div style={{marginBottom:"6pt"}}/>
            { check.__showingHistory && (<>
                { check.history?.list?.length > 0 ? (<>
                    <table style={{width:"100%"}}>
                        <TableHead columns={columns} list={check.history.list} refresh={() => refreshHistory(check, env, historyList)} update={(e) => historyList.update()} style={{color:Styles.GetForegroundColor(),fontWeight:"bold"}} lines={true} />
                    <tbody>
                    {check.history.list.map((history, index) => <React.Fragment key={index}>
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
                                <span onClick={() => {toggleHistoryResult(check, history, extractUuid(history), historyList); }} style={{cursor:"pointer"}}>{extractTimestamp(history)}</span>
                            &nbsp;&nbsp;</td>
                            <td style={{whiteSpace:"nowrap"}}>
                                {extractStatus(history) === "PASS" ? (<>
                                    <b style={{color:"inherit"}}>OK</b>
                                </>):(<>
                                    {extractStatus(history) === "WARN" ? (<>
                                        <b style={{color:"black"}}>WARNING</b>
                                    </>):(<>
                                        <b style={{color:"darkred"}}>ERROR</b>
                                    </>)}
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
                                    <pre className="box lighten" style={{wordWrap: "break-word",paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"4pt",marginTop:"4pt",marginRight:"5pt",minWidth:"360pt",maxWidth:"680pt"}}>
                                        { history.__resultLoading ? <>
                                            <StandardSpinner condition={history.__resultLoading} color={Styles.GetForegroundColor()} label="Loading result"/>
                                        </>:<>
                                            <div style={{float:"right",marginTop:"-0px"}}>
                                                <span style={{fontSize:"0",opacity:"0"}} id={check}>{Json.Str(history.__result[0])}</span>
                                                <img alt="copy" onClick={() => Clipboard.Copy(check)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                                                <span onClick={() => hideHistoryResult(history, historyList)} style={{marginLeft:"6pt",marginRight:"2pt",fontSize:"large",fontWeight:"bold",cursor:"pointer"}}>X</span>
                                            </div>
                                            {Yaml.Format(history.__result[0])}
                                        </>}
                                    </pre>
                                </td>
                            </tr>
                        }
                    </React.Fragment>)}
                    </tbody>
                    </table>
                </>):(<>
                    { check.history?.list ? (<>
                        <div style={{color:"black", borderTop:"1px solid", paddingTop:"4pt"}}>
                            { historyList.loading ? <>
                                <StandardSpinner condition={true} color={Styles.GetForegroundColor()} label="Loading history" />
                            </>:<>
                                No history &nbsp;
                                <b onClick={() => fetchHistory(check, env, historyList)} style={{cursor:"pointer"}}>{Char.Refresh}</b>
                            </>}
                        </div>
                    </>):(<>
                        <div style={{color:"black", borderTop:"1px solid"}} />
                        <StandardSpinner condition={!check.history} color={Styles.GetForegroundColor()} label="Loading history" />
                    </>)}
                </>)}
            </>)}
        </div>
    }

    const ResultsHistoryPanel = ({ env }) => {
        let histories = historyList.filter((check) => check.__showingHistory);
        if (histories.length <= 0) {
            return <span />
        }
        return <div>
            <b style={{marginBottom:"100pt"}}>Recent Results Histories</b>
            { histories.map((selectedHistory, index) =>
                <div key={index} style={{marginTop:"3pt"}}>
                    <ResultsHistoryBox check={selectedHistory} env={env} />
                </div>
            )}
        </div>
    }

    function showHistoryResult(check, history, uuid, historyList) {
        history.__resultShowing = true;
        history.__resultLoading = true;
//      history.__resultError = false;
        historyList.update();
        historyList.refresh({
            url: Server.Url(`/checks/${check.name}/${uuid}`, environ),
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
//      history.__resultError = false;
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

    // TODO
    // Need to start figuring out how to factor out all of this stuff into sub-components.

    const checksRaw = useFetch(null);
    const [ checksRawHide, setChecksRawHide] = useState(false);

    function isShowingChecksRaw() {
        return !checksRaw.empty;
    }

    function showChecksRaw() {
        setChecksRawHide(false);
        checksRaw.refresh(Server.Url(`/checks-raw`, environ));
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

    const ChecksRawView = ({ info }) => {
        return isShowingChecksRaw() && !checksRawHide && <>
            <b className="tool-tip" data-text={info.get("checks.file")}>Raw Checks</b> {Char.RightArrow} <span style={{fontSize:"9pt"}}>{info.get("checks.file")}</span>
            <div style={{marginTop:"3pt"}}>
            <pre className="box lighten">
            { checksRaw.loading ? <>
                <StandardSpinner loading={checksRaw.loading} label={"Loading raw checks file"} size={60} color={"black"} />
            </>:<>
                <div style={{float:"right",marginTop:"-2pt"}}>
                    <span style={{fontSize:"0",opacity:"0"}} id={"checks-raw"}>{checksRaw.json()}</span>
                    <img alt="copy" onClick={() => Clipboard.Copy("checks-raw")} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
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

    const recentRuns = useFetch(Server.Url("/checks/history/recent?limit=20", environ), { nofetch: true });
    const [ recentRunsShow, setRecentRunsShow] = useState(false);

    function isShowingRecentRuns() {
        return !recentRuns.empty;
    }

    function showRecentRuns() {
        setRecentRunsShow(true);
        recentRuns.refresh();
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
            <b>Recent Runs</b>
            <div className="box" style={{paddingTop:"4pt",paddingBottom:"6pt",marginTop:"3pt",marginBottom:"8pt"}}>
                { recentRuns.loading ? <>
                    <StandardSpinner loading={recentRuns.loading} label={"Loading recent runs"} size={60} color={Styles.GetForegroundColor()} />
                </>:<>
                    { !recentRuns.empty && <small>
                        {/* TODO: Get this info from TableHead */}
                        { (recentRuns.data?.__sort?.key === "timestamp" && recentRuns.data?.__sort?.order === -1) ? <>
                            <b>Most Recent</b>:&nbsp;
                        </>:<>
                            <b>Top</b>:&nbsp;
                        </>}
                        <LiveTime.FormatDuration start={recentRuns?.data[0]?.timestamp} verbose={true} fallback={"just now"} suffix={"ago"} tooltip={true} />
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
                            lines={true} />
                        <tbody>
                            { recentRuns.map((run, index) => <React.Fragment key={index}>
                                    
                                { index > 0 && <React.Fragment>
                                    <tr><td style={{paddingTop:"2px"}}></td></tr>
                                    <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                                </React.Fragment>}
                                <tr key={index} style={{verticalAlign:"top"}}>
                                    <td>
                                        { run.status === "PASS" ?
                                            <span style={{color:Styles.GetForegroundColor()}}>{Char.Check}</span>
                                        :   <span style={{color:"darkred"}}>{Char.X}</span> }
                                    &nbsp;</td>
                                    <td  style={{width:"10%"}} className="tool-tip" data-text={Time.FormatDuration(run.timestamp, new Date(), true, null, null, "ago")}>
                                        {Time.FormatDate(run.timestamp)} <br />
                                        <small>{Time.FormatTime(run.timestamp)}</small>
                                    &nbsp;&nbsp;</td>
                                    <td style={{width:"30%"}}>
                                        <span style={{cursor:"pointer"}} onClick={() => onClickShowHistory(findCheck(run.check, run.group), environ, historyList)}>{run.title}</span> <br />
                                        <i><small style={{cursor:"pointer"}} onClick={() => toggleShowGroup(findGroup(run.group), environ, groupList, historyList)}>{run.group}</small></i>&nbsp;
                                        <Link to={Client.Path(`/checks/${run.check}/history`)} className={"tool-tip"} data-text={"Click for full history."} rel="noreferrer" target="_blank"><img alt="history" src={Image.History()} style={{marginBottom:"4px",height:"17"}} /></Link>
                                    &nbsp;&nbsp;</td>
                                    <td>&nbsp;
                                        {run.status === "PASS" ? (<>
                                            <b style={{color:Styles.GetForegroundColor()}}>OK</b>
                                        </>):(<>
                                            <b style={{color:"darkred"}}>ERROR</b>
                                        </>)}
                                    &nbsp;&nbsp;</td>
                                    <td align="right">
                                        {run.duration}
                                    &nbsp;&nbsp;</td>
                                    <td>
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
            <table><tbody className="tool-tip" data-text="Click to refresh current check run status."><tr><td style={{whiteSpace:"nowrap",paddingBottom:"3pt"}}>
            <b style={{cursor:"pointer",marginBottom:"10pt"}} onClick={() => refreshChecksStatus()}>Checks Status</b>
            &nbsp;&nbsp;
            </td><td>
            { checksStatus.loading ? <>
                { <StandardSpinner loading={checksStatus.loading} label={""} size={60} color={"black"} /> }
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
        return <div>
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
            return <>
                <b>Lambdas</b>
                { lambdasShowing?.map(lambda =>
                     <LambdaView key={lambda.lambda_name} lambda={lambda} />
                )}
            </>
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
                            <td className="tool-tip" data-text={lambda.lambda_schedule}style={tdLabelStyle}>Schedule:</td>
                            <td style={tdContentStyle}><i>{lambda.lambda_schedule_description}</i></td>
                        </tr>
                        <tr><td colSpan="2" style={{height:"4pt"}}></td></tr>
                        <tr><td colSpan="2" style={{height:"1px",background:"gray"}}></td></tr>
                        <tr><td colSpan="2" style={{height:"4pt"}}></td></tr>
                    </>}
                    <tr>
                        <td style={tdLabelStyle}>Handler:</td>
                        <td style={tdContentStyle} className="tool-tip" data-text={lambda.lambda_function_arn}>
                            {lambda.lambda_handler} <br />
                            <small>{lambda.lambda_function_name}</small>
                        </td>
                    </tr>
                    <tr>
                        <td style={tdLabelStyle}><small>Role:</small></td>
                        <td className="tool-tip" data-text={lambda.lambda_role} style={tdContentStyle}>
                            <small>{lambda.lambda_role?.replace(/.*\//,'')}</small>
                        </td>
                    </tr>
                    <tr>
                        <td style={tdLabelStyle}>Updated:</td>
                        <td style={tdContentStyle}><span className="tool-tip" data-text={Time.Ago(lambda.lambda_modified)} >{Time.FormatDateTime(lambda.lambda_modified)}</span></td>
                    </tr>
                    <tr style={{fontSize:"small"}}>
                        <td style={tdLabelStyle}>Code:</td>
                        <td style={tdContentStyle} className="tool-tip" data-text="S3 Code Location">
                            <a href={`https://s3.console.aws.amazon.com/s3/object/${lambda.lambda_code_s3_bucket}?region=us-east-1&prefix=${lambda.lambda_code_s3_bucket_key}`} rel="noreferrer" target="_blank">{lambda.lambda_code_s3_bucket_key}</a> <br />
                            <small><a href={`https://s3.console.aws.amazon.com/s3/buckets/${lambda.lambda_code_s3_bucket}?region=us-east-1&tab=objects`} rel="noreferrer" target="_blank">{lambda.lambda_code_s3_bucket}</a></small>
                        </td>
                    </tr>
                    <tr>
                        <td style={tdLabelStyle}>Code Size:</td>
                        <td style={tdContentStyle}><span className="tool-tip" data-text={lambda.lambda_code_size} >{Str.FormatBytes(lambda.lambda_code_size)}</span></td>
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
                                            <td style={{...tdContentStyle}} className="tool-tip" data-text={lambda_check.check_name}>
                                                { (getCheck(lambda_check.check_name, lambda_check.check_group)) ? <>
                                                    <b style={{color:Styles.GetForegroundColor(),cursor:"pointer"}} onClick={() => onClickShowHistory(findCheck(lambda_check.check_name, lambda_check.check_group), environ, historyList)}>{lambda_check.check_title}</b> <br />
                                                    <i style={{color:Styles.GetForegroundColor(),cursor:"pointer"}} onClick={() => toggleShowGroup(findGroup(lambda_check.check_group), environ, groupList, historyList)}>{lambda_check.check_group}</i>
                                                </>:<>
                                                    <b style={{color:"#444444"}}>{lambda_check.check_title}</b> <br />
                                                    <i style={{color:"#444444"}}>{lambda_check.check_group}</i>
                                                </>}
                                            </td>
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
        <div>
            <table><tbody>
                <tr>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <ChecksGroupBox />
                        <div className="box thickborder check-pass padding-small cursor-hand" style={{marginBottom:"8pt"}}>
                            <RecentRunsControl />
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:Styles.GetForegroundColor()}} />
                            <ChecksRawControl />
                        </div>
                        <ChecksStatus />
                        <LambdasPanel />
                    </td>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <ChecksRawView info={info} />
                        <SelectedGroupsPanel env={environ} groupList={groupList} historyList={historyList} info={info} />
                    </td>
                    <td style={{paddingLeft: (groupList?.length > 0 || groupList.error || isShowingChecksRaw()) ? "10pt" : "0",verticalAlign:"top"}}>
                        <LambdasView />
                        <RecentRunsView />
                        <ResultsHistoryPanel env={environ} />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
}

// This is outside because finally starting to factor out into independent components.
const RunActionBox = ({ check }) => {
    const [ runActionConfirm, setRunActionConfirm ] = useState();
    const [ runAction, setRunAction ] = useState();
        useEffect(() => {
            setRunActionConfirm(false);
            setRunAction(false);
        }, []);
    function onClickRunAction() {
        if (runActionConfirm) {
            // 
            // TODO
            //
            setRunActionConfirm(false);
            setRunAction(true);
        }
        else {
            setRunActionConfirm(true);
            setRunAction(false);
        }
    }
    function onClickRunActionCancel() {
        setRunActionConfirm(false);
        setRunAction(false);
    }
    function onClickRunActionResultClose() {
        setRunActionConfirm(false);
        setRunAction(false);
    }
    return <>
        { check.__configuringCheckRun && check.__result?.get("action") && <>
            <div className="box thickborder" style={{background:"lightyellow",fontSize:"small",marginTop:"4pt",paddingTop:"8pt",paddingBottom:"8pt"}}>
                <div style={{marginTop:"0pt"}}>
                    <b><u>Action</u></b>: <span className="tool-tip" data-text={check.__result.get("action")}>{check.__result.get("action_title")}</span>
                        <div style={{float:"right",marginTop:"-2pt"}}>
                            {check.__result.get("allow_action") ? <>
                                <button className="check-run-button" style={{background:runActionConfirm ? "red" : "inhert"}} onClick={onClickRunAction}>{Char.RightArrowFat} Run Action</button>
                            </>:<>
                                <button className="check-run-button" disabled={true}>Disabled</button>
                            </>}
                        </div>
                </div>
                { runActionConfirm && <>
                    <div style={{borderTop:"1px solid",marginTop:"8pt",marginBottom:"8pt"}}/>
                    <b style={{color:"red"}}>{Char.RightArrow}&nbsp;<i>Are you sure you want to run this action?</i></b>
                    <span className="check-action-confirm-button" style={{float:"right",marginTop:"-3pt"}} onClick={onClickRunActionCancel}>&nbsp;<b>Cancel</b></span>
                </>}
                { runAction && <>
                    <div style={{borderTop:"1px solid",marginTop:"8pt",marginBottom:"8pt"}} />
                    <b style={{float:"right",cursor:"pointer"}} onClick={onClickRunActionResultClose}>{Char.X}&nbsp;</b>
                    <i><b>Running actions are not yet supported ...</b></i>
                </>}
            </div>
        </>}
    </>
}

export default ChecksPage;
