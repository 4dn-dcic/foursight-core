import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Uuid from 'react-uuid';
import { RingSpinner, PuffSpinnerInline, StandardSpinner } from '../Spinners';
import { useReadOnlyMode } from '../ReadOnlyMode';
import { useFetch, useFetchFunction } from '../utils/Fetch';
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

const ChecksPage = (props) => {

    // TODO: Lotsa refactoring ...

    const fetch = useFetchFunction();

    let { environ } = useParams();
    // let [ groupedChecks, setGroupedChecks ] = useState([]);
//  let [ lambdas, setLambdas ] = useState([]);
//  let [ loading, setLoading ] = useState(true);
//  let [ error, setError ] = useState(false);
//  let [ selectedGroups, setSelectedGroups ] = useState([])
//  let [ selectedHistories, setSelectedHistories ] = useState([])
//  let [ checksStatus, setChecksStatus ] = useState({});
//  let [ checksStatusLoading, setChecksStatusLoading ] = useState(true);
    const [ readOnlyMode ] = useReadOnlyMode();
    const historyList = useFetch({ initial: [] });
    const groupList = useFetch({ initial: [] });
    const info = useFetch(Server.Url("/info")); // only to get the raw checks file path for info/display
        
    // TODO IN PROGRESS: MOVING TO NEW useFetch HOOK.

    const checks = useFetch({
        url: Server.Url("/checks", environ),
        onData: (data) => {
            data.sort((a,b) => a.group > b.group ? 1 : (a.group < b.group ? -1 : 0));
            if (data.length > 0) {
                //
                // Choose some group as default to show.
                //
                let group = data.find(item => item.group.toLowerCase().includes("elasticsearch"));
                if (!group) group = data[0];
                showGroup(group);
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

/*
        Fetch.get(Server.Url(`/checks`, environ),
                  groupedChecks => {
                      setGroupedChecks(groupedChecks.sort((a,b) => a.group > b.group ? 1 : (a.group < b.group ? -1 : 0)));
                      if (groupedChecks.length > 0) {
                          //
                          // Choose some group as default to show.
                          //
                          let group = groupedChecks.find(item => item.group.toLowerCase().includes("elasticsearch"));
                          group = group ? group : groupedChecks[0];
                          showGroup(group);
                      }
                  },
                  setLoading, setError);
        Fetch.get(Server.Url(`/lambdas`, environ),
                  lambdas => {
                      setLambdas(lambdas.sort((a,b) => a.lambda_name > b.lambda_name ? 1 : (a.lambda_name < b.lambda_name ? -1 : 0)));
                  });
*/

        refreshChecksStatus();

        // This running periodically screws up the check run configuration inputs.
        // setInterval(() =>  refreshChecksStatus(), 10000);

    }, []);

    const checksStatus = useFetch();
    function refreshChecksStatus() {
        checksStatus.refresh(Server.Url(`/checks-status`, environ));
    }

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
                if (schedule_env_key.toLowerCase() === "all" || Env.Equals(schedule_env_key, environ)) {
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

    function isSelectedGroup(group) {
        for (let i = 0 ; i < groupList.length ; i++) { // Experimental
            const selectedGroup = groupList.get(i);
            if (selectedGroup.group === group.group) {
                return true;
            }
        }
/*
        for (let i = 0 ; i < selectedGroups?.length ; i++) {
            const selectedGroup = selectedGroups[i]
            if (selectedGroup.group === group.group) {
                return true;
            }
        }
*/
        return false;
    }

    function findSelectedGroupIndex(group) {
        for (let i = 0 ; i < groupList.length ; i++) {
            const selectedGroup = groupList.get(i);
            if (selectedGroup.group === group.group) {
                return i;
            }
        }
/*
        for (let i = 0 ; i < selectedGroups.length ; i++) {
            const selectedGroup = selectedGroups[i]
            if (selectedGroup.group === group.group) {
                return i;
            }
        }
*/
        return -1;
    }

    function noteChangedSelectedGroups() {
        // setSelectedGroups(existing => [...existing]);
        groupList.update(); // Experimental
    }

    function noteChangedResults() {
        // setSelectedGroups(existing => [...existing]);
        groupList.update(); // Experimental
    }

    function noteChangedCheckBox() {
        // setSelectedGroups(existing => [...existing]);
        groupList.update(); // Experimental
    }

//  function noteChangedHistories() {
//      setSelectedHistories(existing => [...existing]);
//  }

    function toggleShowGroup(group, showResults = true) {
        if (isSelectedGroup(group)) {
            hideGroup(group);
        }
        else {
            showGroup(group, showResults);
        }
    }
    function showGroup(group, showResults = true) {
        if (isSelectedGroup(group)) {
            return;
        }
        // selectedGroups.unshift(group);
        // noteChangedResults();
        groupList.prepend(group); // Experimental
        if (showResults) {
            group.checks.map(check => showResultBox(check));
        }
    }
    function hideGroup(group) {
        group.checks.map(check => hideHistory(check));
        const index = findSelectedGroupIndex(group);
        // selectedGroups.splice(index, 1);
        // noteChangedResults();
        groupList.remove(index); // Experimental
    }

    function onGroupSelectAll(group) {
        if (checks.length === groupList.length) { // Experimental
            groupList.update([]);
        }
        else {
            groupList.update([...checks.data]);
        }
/*
        if (checks.data.length === selectedGroups.length) {
            setSelectedGroups([checks.data[0]]);
        }
        else {
            setSelectedGroups([...checks.data]);
        }
*/
    }

    const ChecksGroupBox = ({props}) => {
        return <div style={{minWidth:"150pt"}}>
            <div style={{fontWeight:"bold",paddingBottom:"3pt",cursor:"pointer"}} onClick={() => onGroupSelectAll()}>&nbsp;Check Groups</div>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                { checks.map((datum, index) =>
                    <div key={datum.group}>
                        <span style={{fontWeight:isSelectedGroup(datum) ? "bold" : "normal",cursor:"pointer"}} onClick={() => toggleShowGroup(datum)}>
                            {datum.group}
                        </span>
                        { index < checks.length - 1 &&
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"darkgreen"}} />
                        }
                    </div>
                )}
            </div>
        </div>
    }

    const LambdasBox = ({props}) => {
        return <div>
            <div style={{fontWeight:"bold",paddingBottom:"3pt"}}>&nbsp;Lambdas</div>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                { lambdas.map((datum, index) =>
                    <div key={datum.lambda_name} title={datum.lambda_function_name}>
                        {datum.lambda_name}
                        { index < lambdas.length - 1 &&
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"darkgreen"}} />
                        }
                    </div>
                )}
            </div>
        </div>
    }

    function onClickSelectedGroupsTitle(checks) {
        const showingAnyGroupsResults = isShowingAnyGroupsResults();
        for (let i = 0 ; i < groupList.length ; i++) {
            if (showingAnyGroupsResults) {
                hideAllResults(groupList.get(i).checks);
            }
            else {
                showAllResults(groupList.get(i).checks);
            }
        }
/*
        for (let i = 0 ; i < selectedGroups.length ; i++) {
            if (showingAnyGroupsResults) {
                hideAllResults(selectedGroups[i].checks);
            }
            else {
                showAllResults(selectedGroups[i].checks);
            }
        }
*/
    }

    function isShowingAnyGroupsResults() {
        for (let i = 0 ; i < groupList.length ; i++) {
            if (isShowingAnyResults(groupList.get(i)?.checks)) {
                return true;
            }
        }
/*
        for (let i = 0 ; i < selectedGroups.length ; i++) {
            if (isShowingAnyResults(selectedGroups[i]?.checks)) {
                return true;
            }
        }
*/
        return false;
    }

    function isShowingAnyResultDetails() {
        for (let i = 0 ; i < groupList.length ; i++) {
            for (let j = 0 ; j < groupList.get(i)?.checks?.length ; j++) {
                if (groupList.get(i).checks[j].showingResultDetails) {
                    return true;
                }
            }
        }
/*
        for (let i = 0 ; i < selectedGroups?.length ; i++) {
            for (let j = 0 ; j < selectedGroups[i]?.checks?.length ; j++) {
                if (selectedGroups[i].checks[j].showingResultDetails) {
                    return true;
                }
            }
        }
*/
        return false;
    }

    function isShowingAllResultDetails() {
        for (let i = 0 ; i < groupList.length ; i++) {
            for (let j = 0 ; j < groupList.get(i)?.checks?.length ; j++) {
                if (!groupList.get(i).checks[j].showingResultDetails) {
                    return false;
                }
            }
        }
/*
        for (let i = 0 ; i < selectedGroups?.length ; i++) {
            for (let j = 0 ; j < selectedGroups[i]?.checks?.length ; j++) {
                if (!selectedGroups[i].checks[j].showingResultDetails) {
                    return false;
                }
            }
        }
*/
        return true;
    }

    function showAllResultDetails() {
        // selectedGroups?.map(group => group.checks.map(check => check.showingResultDetails = true));
        groupList.map(group => group.checks.map(check => check.showingResultDetails = true));
        noteChangedResults();
    }

    function hideAllResultDetails() {
        // selectedGroups?.map(group => group.checks.map(check => check.showingResultDetails = false));
        groupList.map(group => group.checks.map(check => check.showingResultDetails = false));
        noteChangedResults();
    }


    function runCheck(check) {
        const args = check.kwargs;
        const argsString = Json.Str(args);
        const argsEncoded = btoa(argsString);
        hideCheckRunningBox(check);
        noteChangedCheckBox();
        check.queueingCheckRun = true;
        check.fetchingResult = true;
        fetch({
            url: Server.Url(`/checks/${check.name}/run?args=${argsEncoded}`, environ),
            onData: (data) => {
                //
                // The only thing we need/want from this is the UUID identifying the check run.
                //
                check.queueingCheckRun = false;
                check.fetchingResult = false;
                check.queuedCheckRun = data.uuid;
                //
                // For user convenience do what they plausably would do anyways: refresh the history,
                // a few (4) seconds after this check run completes (here).
                //
                setTimeout(() => {
                    if (!check.fetchingResult) {
                        refreshHistory(check); noteChangedCheckBox();
                    }
                }, 4 * 1000);
                return data.uuid;
            }
        });
/*
        Fetch.get(Server.Url(`/checks/${check.name}/run?args=${argsEncoded}`, environ),
                  response => {
                      check.queueingCheckRun = false;
                      check.fetchingResult = false;
                      check.queuedCheckRun = response.uuid
                  });
*/
        check.queuedCheckRun = null;
        showCheckRunningBox(check);
        showHistory(check);
        // setTimeout(() => { if (!check.fetchingResult) { refreshHistory(check); noteChangedCheckBox(); } }, 10000);
    }

    function showCheckRunningBox(check) {
        check.showingCheckRunningBox = true;
        noteChangedCheckBox();
    }

    function hideCheckRunningBox(check) {
        check.showingCheckRunningBox = false;
        noteChangedCheckBox();
    }

    // The (yellow) check running box.
    const CheckRunningBox = ({check}) => {
        return !check.showingCheckRunningBox ? <span /> : <div>
            <div className="boxstyle check-pass" style={{marginTop:"4pt",padding:"6pt",cursor:"default",borderColor:"red",background:"yellow",filter:"brightness(0.9)"}} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                { !check.queueingCheckRun && <span style={{float:"right",cursor:"pointer"}} onClick={(e) => { hideCheckRunningBox(check);e.stopPropagation(); e.preventDefault(); }}></span> }
                {  check.queuedCheckRun && <small><b>Queued check run {Time.FormatDateTime(Time.Now())} {Char.RightArrow} <u>{check.queuedCheckRun}</u></b></small> }
                { !check.queuedCheckRun && <StandardSpinner condition={check.queueingCheckRun} label={" Queueing check run"} color={"darkgreen"} /> }
            </div>
        </div>
    } 

    // What a pain ...
    const CheckRunArgsBox = ({check,update}) => {
        if (!Type.IsNonEmptyObject(check.kwargs)) {
            check.kwargs = getKwargsFromCheck(check);
        }
        return check.configuringCheckRun && <>
            <div className="boxstyle" style={{marginTop:"4pt",padding:"6pt",cursor:"default",borderColor:"green",background:"lightyellow"}} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
                { (Type.IsNonEmptyObject(check.kwargs)) ? (<>
                    <div style={{marginTop:"-2pt",float:"right"}}>
                        <RunButton check={check} style={{float:"right"}} />
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
                                        noteChangedCheckBox();
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
                                        noteChangedCheckBox();
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
                        <RunButton check={check} style={{float:"right"}} />
                    </div>
                    No arguments.
                </>)}
            </div>
        </>
    }

    const SelectedGroupsPanel = ({props}) => {
        return <div>
            { groupList.length > 0 /* selectedGroups.length > 0 */ ? (<>
                <div style={{paddingBottom:"3pt"}}>
                    <span style={{cursor:"pointer"}} onClick={() => onClickSelectedGroupsTitle()}>
                        &nbsp;
                        <b>Check Details</b>
                        { isShowingAnyGroupsResults() ? (<>
                            &nbsp;{Char.DownArrow}
                        </>):(<>
                            &nbsp;{Char.UpArrow}
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
                { groupList.map((selectedGroup, index) /* selectedGroups?.map((selectedGroup, index) */ =>
                    <SelectedGroupBox key={index} group={selectedGroup} style={{paddingBottom:"6pt"}}/>
                )}
            </>):(<></>)}
        </div>
    }

    const SelectedGroupBox = ({group, style = {}}) => {

        return <div style={style}>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"300pt"}}>
                <div>
                    <span style={{cursor:"pointer"}} onClick={() => toggleShowAllResults(group?.checks)}><b>{group?.group}</b> {isShowingAnyResults(group?.checks) ? (<span>{Char.DownArrow}</span>) : (<span>{Char.UpArrow}</span>)}</span>
                    <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideGroup(group)})}><b>{Char.X}</b></span>
                </div>
                <div style={{marginTop:"6pt"}} />
                { group?.checks?.map((check, index) =>
                    <div key={index}>
                        { index > 0 && <div style={{marginBottom:"12px"}} /> }
                        <SelectedChecksBox check={check} index={index}/>
                    </div>
                )}
            </div>
        </div>
    }

    // This RunButton is context sensitive. As it first appears clicking on it will
    // just show the run args configuration box (and then that button will turn into
    // a configure button which when clicked will hide the args configuration box);
    // and when the args configuration box is showing this RunButton, which will be
    // place inside the args configuration box, will actually run the check when clicked.
    //
    const RunButton = ({check, style}) => {
        if (check.queueingCheckRun || check.fetchingResult) {
            return check.queueingCheckRun && <div className={"check-run-wait-button"} style={style}>
                <span
                 className={"tool-tip"}
                 data-text={"Wait until " + (check.queueingCheckRun ? "check queueing" : "result fetch") + " completes."}>
                     <span>Queueing</span>
                 </span>
            </div>
        }
        return <div>
            <div className={"check-run-button"} style={{...style, cursor:readOnlyMode && check.configuringCheckRun ? "not-allowed" : "",background:readOnlyMode && check.configuringCheckRun ? "#888888" : "",color:check.configuringCheckRun ? "yellow" : ""}}
                onClick={(e) => {
                    if (check.configuringCheckRun) {
                        if (!readOnlyMode) {
                            saveInputKwargs(check);
                            showResultBox(check);
                            runCheck(check);
                        }
                    }
                    else {
                        check.configuringCheckRun = true;
                        showResultBox(check);
                        noteChangedCheckBox(check);
                    }
                }}>
                <span className={"tool-tip"} data-text={readOnlyMode ? "Run disabled because in readonly mode." : "Click to run this check."}>
                    { !readOnlyMode ? <>
                        { check.configuringCheckRun ? <>
                            <span style={{fontSize:"small"}}>{Char.RightArrowFat}</span>&nbsp;<span>Run</span>
                        </>:<>
                            <span style={{fontSize:"small"}}></span>&nbsp;<span>Run ...</span>
                        </>}
                    </>:<>
                        { check.configuringCheckRun ? <>
                            <span style={{fontSize:"",color:"#DDDDDD",background:"#888888"}}><small>&nbsp;</small>Disabled</span>
                        </>:<>
                            <span style={{fontSize:"small"}}></span>&nbsp;<span>Run ...</span>
                        </>}
                    </>}
                </span>
            </div>
        </div>
    }

    const RefreshResultButton = ({check, style}) => {
        return <span>
            <span style={{...style, cursor:!check.fetchingResult ? "pointer" : "not-allowed",color:"darkred",fontSize:"12pt"}} onClick={() => !check.fetchingResult && refreshResults(check)}>
                <b data-text={check.results ? "Click here to fetch the latest results." : "Fetching the latest results."} className={"tool-tip"}>{Char.Refresh}</b>
            </span>
        </span>
    }

    const ToggleHistoryButton = ({check, style}) => {
        return <span style={{...style, xpaddingTop:"10px",cursor:"pointer"}} onClick={() => onClickShowHistory(check)}>
            <span data-text={"Click here to " + (check.showingHistory ? "hide" : "show") + " recent history of check runs."} className={"tool-tip"}>
                <img alt="history" onClick={(e) => {}} src={Image.History()} style={{marginBottom:"4px",height:"17"}} />
            </span>
            { check.showingHistory ? <span style={{xpaddingTop:"10px"}}>{Char.RightArrow}</span> : <></> }
        </span>
    }

    const SelectedChecksBox = ({check, index}) => {
        return <div>
            <div className="boxstyle check-box" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"450pt"}}>
            <table style={{width:"100%"}}>
                <tbody>
                    <tr style={{height:"3pt"}}><td></td></tr>
                    <tr>
                        <td style={{verticalAlign:"top",width:"1%","cursor":"pointer"}} onClick={() => {toggleCheckResultsBox(check)}}>
                            <b>{ isShowingSelectedCheckResultsBox(check) ? <span>{Char.DownArrow}</span> : <span>{Char.RightArrow}</span> }&nbsp;</b>
                        </td>
                        <td style={{veriticalAlign:"top",maxWidth:"600pt",width:"100%"}} title={check.name}>
                            { (!check.configuringCheckRun) ? <>
                                <RunButton check={check} style={{marginLeft:"30pt",marginTop:"-3pt",float:"right"}} />
                            </>:<>
                                { (check.queueingCheckRun || check.fetchingResult) ? <>
                                    <div className={"check-config-wait-button"} style={{float:"right"}}>
                                        <span className={"tool-tip"} data-text={"Configure run below."} style={{}}><span style={{fontSize:"small"}}>{Char.DownArrowFat}</span>&nbsp;Configure</span>
                                    </div>
                                </>:<>
                                    <div
                                        className={check.configuringCheckRun ? "check-config-button" : "check-run-button"} style={{float:"right"}}
                                        onClick={() => {
                                            if (check.configuringCheckRun) {
                                                saveInputKwargs(check);
                                                check.configuringCheckRun = false;
                                            }
                                            else {
                                                check.configuringCheckRun = true;
                                            }
                                            noteChangedCheckBox();
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
                            <u style={{cursor:"pointer",fontWeight:isShowingSelectedCheckResultsBox(check) ? "bold" : "normal"}} onClick={() => {onClickShowHistory(check);/*toggleCheckResultsBox(check)*/}}>{check.title}</u>
                            <RefreshResultButton check={check} style={{marginLeft:"10pt"}} />
                            <ToggleHistoryButton check={check} style={{marginLeft:"4pt"}} />
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
                            <CheckRunArgsBox check={check} update={() => noteChangedCheckBox()}/>
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
        </div>
    }

    const ResultDetailsBox = ({check, style}) => {
        return <pre className={check.results?.status?.toUpperCase() === "PASS" ? "check-pass" : "check-warn"} style={{filter:"brightness(1.08)",borderColor:"green",borderWidth:"2",wordWrap: "break-word",paddingBottom:"4pt",marginBottom:"3px",marginTop:"3px",marginRight:"5pt",minWidth:"360pt",maxWidth:"100%"}}>
            <div style={{float:"right",marginTop:"-10px"}}>
            <span style={{fontSize:"0",opacity:"0"}} id={check.name}>{Json.Str(check.showingResultDetailsFull ? check.results.full_output : check.results)}</span>
            <img alt="copy" onClick={() => Clipboard.Copy(check.name)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
            &nbsp;<span style={{fontSize:"x-large",cursor:"pointer",color:"black"}} onClick={() => {check.showingResultDetailsFull = !check.showingResultDetailsFull; noteChangedResults(); } }>{check.showingResultDetailsFull ? <span title="Show full results output.">{Char.UpArrow}</span> : <span>{Char.DownArrow}</span>}</span>
            &nbsp;<span style={{fontSize:"large",cursor:"pointer",color:"black"}} onClick={() => { check.showingResultDetails = false ; noteChangedResults(); }}>X</span>
            </div>
            {!check.results ? <StandardSpinner condition={!check.results} label={"Loading results"} color={"darkgreen"}/> : (Object.keys(check.results).length > 0 ? (Yaml.Format(check.showingResultDetailsFull ? check.results.full_output : check.results)) : "No results.") }
        </pre>
    }

    const ResultBox = ({check}) => {
        return <div>
            { check.results && <small style={{color:check.results?.status?.toUpperCase() === "PASS" ? "darkgreen" : "red",cursor:"pointer"}} onClick={() => { check.showingResultDetails = !check.showingResultDetails ; noteChangedResults(); }}>
                { Object.keys(check.results).length > 0 ? (<>
                    { !check.showingCheckRunningBox && <div style={{height:"1px",marginTop:"2px",marginBottom:"2px",background:"gray"}}></div> }
                    <span>Latest Results: {check.results?.timestamp}</span>
                        { check.showingResultDetails ? (
                            <b className={"tool-tip"} data-text={"Click to hide result details."}>&nbsp;{Char.DownArrow}</b>
                        ):(
                            <b className={"tool-tip"} data-text={"Click to show result details."}>&nbsp;{Char.UpArrow}</b>
                        )}
                    <br />
                    <span style={{color:check.results?.status?.toUpperCase() === "PASS" ? "darkgreen" : "red"}}><span className={"tool-tip"} data-text={"Click to " + (check.showingResultDetails ? "hide" : "show") + " result details."}>Results Summary</span>: {check.results?.summary}</span>&nbsp;&nbsp;
                    { check.results?.status?.toUpperCase() === "PASS" ? (<b style={{fontSize:"12pt",color:"darkgreen"}}>{Char.Check}</b>) : (<b style={{fontSize:"13pt",color:"red"}}>{Char.X}</b>) }
                </>):(<>
                    { !check.showingResultDetails && <span>No recent results.</span> }
                </>)}
            </small> }
            {/* Results details or loading results box */}
            { check.showingResultDetails ? <>
                <ResultDetailsBox check={check} />
            </>:<>
                { !check.results && <StandardSpinner condition={!check.results} label={"Loading results"} color={"darkgreen"}/> }
            </>}
        </div>
    }

    const SelectedCheckResultsBox = ({check}) => {
        return <div>
            {/* Check manually queued box */}
            <CheckRunningBox check={check} />
            {/* Schedule(s) and latest run lines */}
            <ResultBox check={check} />
        </div>
    }

    const ResultsHistoryBox = ({check}) => {

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
            { label: "" },
            { label: "Timestamp", key: extractTimestamp },
            { label: "Status", key: extractStatus},
            { label: "Duration", key: extractDuration, align: "right" },
            { label: "State", key: extractState }
        ];

        return <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
            <div title={check.name}>
                <b className="tool-tip" data-text={`Group: ${check.group}. Check: ${check.name}. Click for full history.`}>
                    <Link to={Client.Path(`/checks/${check.name}/history`)} style={{color:"darkgreen"}} target="_blank">{check.title}</Link>
                </b>&nbsp;
                { check.history && <span>&nbsp;&nbsp;<span className={"tool-tip"} data-text={"Click to refresh history."} style={{cursor:"pointer",color:"darkred",fontWeight:"bold"}} onClick={() => {refreshHistory(check)}}>{Char.Refresh}&nbsp;&nbsp;</span></span> }
                <Link to={Client.Path(`/checks/${check.name}/history`)} className={"tool-tip"} data-text={"Click for full history."} target="_blank"><img alt="history" src={Image.History()} style={{marginBottom:"4px",height:"17"}} /></Link>
                <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideHistory(check)})}><b>{Char.X}</b></span>
            </div>
            <div style={{marginBottom:"6pt"}}/>
            { check.showingHistory && (<>
                { check.history?.list?.length > 0 ? (<>
                    <table style={{width:"100%"}} border="0">
                        <TableHead columns={columns} list={check.history.list} update={(e) => historyList.update()} style={{color:"darkgreen",fontWeight:"bold"}} lines={true} />
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
                                    <span style={{color:"darkgreen"}}>{Char.Check}</span>
                                :   <span style={{color:"darkred"}}>{Char.X}</span> }
                            &nbsp;&nbsp;</td>
                            <td style={{whiteSpace:"nowrap"}}>
                                <span onClick={() => {toggleHistoryResult(check, history, extractUuid(history)); }} style={{cursor:"pointer"}}>{extractTimestamp(history)}</span>
                            &nbsp;&nbsp;</td>
                            <td style={{whiteSpace:"nowrap"}}>
                                {extractStatus(history) === "PASS" ? (<>
                                    <b style={{color:"darkgreen"}}>OK</b>
                                </>):(<>
                                    <b style={{color:"darkred"}}>ERROR</b>
                                </>)}
                            &nbsp;&nbsp;</td>
                            <td style={{textAlign:"right"}}>
                                {extractDuration(history)}
                            &nbsp;&nbsp;</td>
                            <td style={{whiteSpace:"nowrap"}}>
                                {extractState(history)}
                            &nbsp;&nbsp;</td>
                            </tr>
                        </React.Fragment>
                        { (history.__resultShowing) &&
                            <tr>
                                <td colSpan="9">
                                    <pre style={{background:"#DFF0D8",filter:"brightness(1.2)",borderColor:"darkgreen",borderWidth:"1",wordWrap: "break-word",paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"4pt",marginTop:"4pt",marginRight:"5pt",minWidth:"360pt",maxWidth:"600pt"}}>
                                        { history.__resultLoading ? <>
                                            <StandardSpinner condition={history.__resultLoading} color={"darkgreen"} label="Loading result"/>
                                        </>:<>
                                            <div style={{float:"right",marginTop:"-0px"}}>
                                                <span style={{fontSize:"0",opacity:"0"}} id={check}>{Json.Str(history.__result[0])}</span>
                                                <img alt="copy" onClick={() => Clipboard.Copy(check)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                                                <span onClick={() => hideHistoryResult(history)} style={{marginLeft:"6pt",marginRight:"2pt",fontSize:"large",fontWeight:"bold",cursor:"pointer"}}>X</span>
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
                        <span style={{color:"black"}}>No history.</span>
                    </>):(<>
                        <StandardSpinner condition={!check.history} color={"darkgreen"} label="Loading history" />
                    </>)}
                </>)}
            </>)}
        </div>
    }

    const ResultsHistoryPanel = () => {
        // let histories = selectedHistories?.filter((check) => check.showingHistory);
        let histories = historyList.filter((check) => check.showingHistory); // Experimental
        if (histories.length <= 0) {
            return <span />
        }
        return <div>
            <b style={{marginBottom:"100pt"}}>Recent Results Histories</b>
            { histories.map((selectedHistory, index) =>
                <div key={index} style={{marginTop:"3pt"}}>
                    <ResultsHistoryBox check={selectedHistory} />
                </div>
            )}
        </div>
    }

    function onClickShowHistory(check) {
        toggleResultsHistory(check);
    }

    function toggleResultsHistory(check) {
        if (check.showingHistory) {
            hideHistory(check);
        }
        else {
            showHistory(check);
        }
    }

    function showHistory(check) {
        if (!check.showingHistory) {
            check.showingHistory = true;
            // selectedHistories.unshift(check);
            // noteChangedHistories();
            historyList.prepend(check); // Experimental
            if (!check.history) {
                historyList.refresh({ // Experimental
                    url: Server.Url(`/checks/${check.name}/history`, environ),
                    onData: (data, current) => {
                        check.history = data;
                        return current;
                    }
                });
/*
                fetch({
                    url: Server.Url(`/checks/${check.name}/history`, environ),
                    onData: (data) => {
                        check.history = data;
                        noteChangedHistories();
                    }
                });
*/
/*
                Fetch.get(Server.Url(`/checks/${check.name}/history`, environ),
                          history => { check.history = history; noteChangedHistories(); });
*/
            }
        }
    }

    function showHistoryResult(check, history, uuid) {
        history.__resultShowing = true;
        history.__resultLoading = true;
//      history.__resultError = false;
        // noteChangedHistories();
        historyList.update(); // Experimental
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
/*
        Fetch.get(Server.Url(`/checks/${check.name}/${uuid}`, environ), response => {
            if (history.__resultShowing) {
                history.__result = response;
                noteChangedHistories();
            }
        }, () => { history.__resultLoading = false; noteChangedHistories(); }, () => { history.__resultError = true; } );
*/
    }

    function hideHistoryResult(history) {
        history.__resultShowing = false;
        history.__result = null;
        history.__resultLoading = false;
//      history.__resultError = false;
        // noteChangedHistories();
        historyList.update(); // Experimental
    }

    function toggleHistoryResult(check, history, uuid) {
        if (history.__resultShowing) {
            hideHistoryResult(history);
        }
        else {
            showHistoryResult(check, history, uuid);
        }
    }

    function hideHistory(check) {
        if (check.showingHistory) {
            check.showingHistory = false;
            const index = findResultsHistoryIndex(check);
            // selectedHistories.splice(index, 1);
            // noteChangedHistories();
            historyList.remove(index); // Experimental
        }
    }

    function findResultsHistoryIndex(check) {
        for (let i = 0 ; i < historyList.length ; i++) {
            const selectedHistory = historyList.get(i)
            if (selectedHistory.name === check.name) {
                return i;
            }
        }
/*
        for (let i = 0 ; i < selectedHistories.length ; i++) {
            const selectedHistory = selectedHistories[i]
            if (selectedHistory.name === check.name) {
                return i;
            }
        }
*/
        return -1;
    }

    function refreshResults(check) {
        check.results = null;
        if (check.showingResults) {
            hideResultBox(check);
        }
        showResultBox(check);
    }

    function refreshHistory(check) {
        check.history = null;
        if (check.showingHistory) {
            hideHistory(check);
            showHistory(check);
        }
    }

    function toggleCheckResultsBox(check) {
        if (check.showingResults) {
            hideResultBox(check);
        }
        else {
            showResultBox(check);
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
        checks.map((check) => !check.showingResults && showResultBox(check));
    }

    function hideAllResults(checks) {
        checks.map((check) => check.showingResults && hideResultBox(check));
    }

    function showResultBox(check) {
        check.showingResults = true;
        noteChangedSelectedGroups();
        if (!check.results) {
            // Fetch the latest results for this check.
            check.fetchingResult = true;
            groupList.refresh({ // Experimental
                url: Server.Url(`/checks/${check.name}`, environ),
                onData: (data, current) => {
                    check.results = data;
                    check.fetchingResult = false;
                    return current;
                }
            });
/*
            fetch({
                url: Server.Url(`/checks/${check.name}`, environ),
                onData: (data) => {
                    check.results = data;
                    check.fetchingResult = false;
                    noteChangedResults();
                    return data;
                }
            });
*/
/*
            Fetch.get(Server.Url(`/checks/${check.name}`, environ),
                      checkResults => { check.results = checkResults; check.fetchingResult = false; noteChangedResults(); },
                      null, setError);
*/
        }
    }

    function hideResultBox(check) {
        check.showingResults = false;
        noteChangedSelectedGroups();
    }

    function isShowingSelectedCheckResultsBox(check) {
        return check?.showingResults;
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
           <span style={{fontWeight:isShowingChecksRaw() ? "bold" : "normal"}} onClick={() => toggleChecksRaw()}>View Raw Checks</span> <br />
        </>
    }

    const ChecksRawView = () => {
        return isShowingChecksRaw() && !checksRawHide && <>
            <b className="tool-tip" data-text={info.get("checks.file")}>Raw Checks</b>
            <div style={{marginTop:"3pt"}}>
            <pre className="check-pass" style={{filter:"brightness(1.08)",borderColor:"green",borderRadius:"4pt"}}>
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
        return checks.data?.find(item => item.group == groupName);
    }

    function findCheck(checkName, groupName) {
        const group = findGroup(groupName)
        return group?.checks?.find(item => item.name == checkName);
    }

    const RecentRunsControl = () => {
        return <>
            <span style={{fontWeight:isShowingRecentRuns() ? "bold" : "normal"}} onClick={() => toggleRecentRuns()}>View Recent Runs</span>&nbsp;&nbsp;
            { recentRuns.loading && <><PuffSpinnerInline condition={true} size={"16px"}/></> }
        </>
    }

    const RecentRunsView = () => {
        const columns = [
            { label: "" },
            { label: "Timestamp", key: "timestamp" },
            { label: "Check", key: "check" },
            { label: "Status", key: "status" },
            { label: "Duration", key: "duration", align: "right" },
            { label: "State", key: "state" }
        ];
        return recentRunsShow && <>
            <b>Recent Runs</b>
            <div className="boxstyle check-pass" style={{paddingTop:"4pt",paddingBottom:"6pt",marginTop:"2pt"}}>
                { recentRuns.loading ? <>
                    <StandardSpinner loading={recentRuns.loading} label={"Loading recent runs"} size={60} color={"black"} />
                </>:<>
                    { !recentRuns.empty && <small>
                        {/* TODO: Get this info from TableHead */}
                        { (recentRuns.data?.__sort?.key == "timestamp" && recentRuns.data?.__sort?.order == -1) ? <>
                            <b>Most Recent</b>:&nbsp;
                        </>:<>
                            <b>Top</b>:&nbsp;
                        </>}
                        <LiveTime.FormatDuration start={recentRuns?.data[0]?.timestamp} verbose={true} fallback={"just now"} suffix={"ago"} tooltip={true} />
                        &nbsp;&nbsp;&nbsp;<b className="tool-tip" data-text="Click to refresh." style={{cursor:"pointer"}} onClick={() => recentRuns.refresh()}>{Char.Refresh}</b>
                    </small>}
                    <b style={{float:"right",paddingBottom:"4pt",cursor:"pointer"}} onClick={hideRecentRuns}>{Char.X}</b>
                    <table style={{width:"100%"}} border="0">
                        <TableHead columns={columns} xtate={{key:"timestamp", order:-1}} list={recentRuns.data} update={() => recentRuns.update()} style={{color:"darkgreen",fontWeight:"bold"}} lines={true} />
                        <tbody>
                            { recentRuns.map((run, index) => <React.Fragment key={index}>
                                <tr key={index} style={{verticalAlign:"top"}}>
                                    <td>
                                        { run.status === "PASS" ?
                                            <span style={{color:"darkgreen"}}>{Char.Check}</span>
                                        :   <span style={{color:"darkred"}}>{Char.X}</span> }
                                    &nbsp;</td>
                                    <td  style={{width:"10%"}} className="tool-tip" data-text={Time.FormatDuration(run.timestamp, new Date(), true, null, null, "ago")}>
                                        {Time.FormatDate(run.timestamp)} <br />
                                        <small>{Time.FormatTime(run.timestamp)}</small>
                                    &nbsp;&nbsp;</td>
                                    <td style={{width:"30%"}}>
                                        <span style={{cursor:"pointer"}} onClick={() => onClickShowHistory(findCheck(run.check, run.group))}>{run.title}</span> <br />
                                        <i><small style={{cursor:"pointer"}} onClick={() => toggleShowGroup(findGroup(run.group))}>{run.group}</small></i>&nbsp;
                                        <Link to={Client.Path(`/checks/${run.check}/history`)} className={"tool-tip"} data-text={"Click for full history."} target="_blank"><img alt="history" src={Image.History()} style={{marginBottom:"4px",height:"17"}} /></Link>
                                    &nbsp;&nbsp;</td>
                                    <td>
                                        {run.status === "PASS" ? (<>
                                            <b style={{color:"darkgreen"}}>OK</b>
                                        </>):(<>
                                            <b style={{color:"darkred"}}>ERROR</b>
                                        </>)}
                                    &nbsp;&nbsp;</td>
                                    <td align="right">
                                        {run.duration}
                                    &nbsp;&nbsp;</td>
                                    <td>
                                        {run.state}
                                    &nbsp;&nbsp;</td>
                                </tr>
                                <tr><td style={{paddingTop:"2px"}}></td></tr>
                                <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            </React.Fragment>)}
                        </tbody>
                    </table>
                </>}
            </div>
        </>
    }

    //

    const ChecksStatus = () => {
        return <>
            <table><tbody><tr><td style={{whiteSpace:"nowrap"}}>
            &nbsp;<b style={{cursor:"pointer"}} onClick={() => refreshChecksStatus()}>Checks Status</b>
            &nbsp;&nbsp;
            </td><td>
            { checksStatus.loading ? <>
                { <StandardSpinner loading={checksStatus.loading} label={""} size={60} color={"black"} /> }
            </>:<>
                <b style={{cursor:"pointer"}} onClick={() => refreshChecksStatus()}>{Char.Refresh}</b>
            </>}
            </td></tr></tbody></table>
            <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                Running: {!checksStatus.loading ? checksStatus.get("checks_running") : "..."}
                <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"darkgreen"}} />
                Queued: {!checksStatus.loading ? checksStatus.get("checks_queued") : "..."}
           </div>
        </>
    }

    if (checks.error) return <>Cannot load checks from Foursight: {checks.error}</>;
    if (checks.loading) {
        return <>
            <div style={{marginTop:"30px"}}>
                <RingSpinner loading={checks.loading} color={'blue'} size={90} />
            </div>
        </>
    }
    return <>
        <div>
            <table><tbody>
                <tr>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <ChecksGroupBox />
                        <div className="boxstyle check-pass padding-small cursor-hand" style={{border:"1px solid darkgreen"}}>
                            <RecentRunsControl />
                            <div style={{marginTop:"3pt",marginBottom:"3pt",height:"1px", backgroundColor:"darkgreen"}} />
                            <ChecksRawControl />
                        </div>
                        <ChecksStatus />
                        <LambdasBox />
                    </td>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <ChecksRawView />
                        <SelectedGroupsPanel />
                    </td>
                    <td style={{paddingLeft:groupList?.length > 0 ? "10pt" : "0",verticalAlign:"top"}}>
                        <RecentRunsView />
                        <ResultsHistoryPanel />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
};

export default ChecksPage;
