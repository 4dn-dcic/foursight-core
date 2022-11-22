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

const ChecksPage = (props) => {

    // TODO: Lotsa refactoring ...

    const fetch = useFetchFunction();

    let { environ } = useParams();
    const [ readOnlyMode ] = useReadOnlyMode();
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
        for (let i = 0 ; i < groupList.length ; i++) {
            const selectedGroup = groupList.get(i);
            if (selectedGroup.group === group.group) {
                return true;
            }
        }
        return false;
    }

    function findSelectedGroupIndex(group) {
        for (let i = 0 ; i < groupList.length ; i++) {
            const selectedGroup = groupList.get(i);
            if (selectedGroup.group === group.group) {
                return i;
            }
        }
        return -1;
    }

    function noteChangedSelectedGroups() {
        groupList.update();
    }

    function noteChangedResults() {
        groupList.update();
    }

    function noteChangedCheckBox() {
        groupList.update();
    }

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
        groupList.prepend(group);
        if (showResults) {
            group.checks.map(check => showResultBox(check));
        }
    }
    function hideGroup(group) {
        group.checks.map(check => hideHistory(check));
        const index = findSelectedGroupIndex(group);
        groupList.remove(index);
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
                        <span style={{fontWeight:isSelectedGroup(datum) ? "bold" : "normal",cursor:"pointer"}} onClick={() => toggleShowGroup(datum)}>
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
    }

    function isShowingAnyGroupsResults() {
        for (let i = 0 ; i < groupList.length ; i++) {
            if (isShowingAnyResults(groupList.get(i)?.checks)) {
                return true;
            }
        }
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
        return true;
    }

    function showAllResultDetails() {
        groupList.map(group => group.checks.map(check => check.showingResultDetails = true));
        noteChangedResults();
    }

    function hideAllResultDetails() {
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
        check.queuedCheckRun = null;
        showCheckRunningBox(check);
        showHistory(check);
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
        const [ showUuid, setShowUuid ] = useState(false);
        return !check.showingCheckRunningBox ? <span /> : <div>
            {/* <div className="box" style={{marginTop:"4pt",padding:"6pt",cursor:"default",borderColor:"red",background:"yellow",filter:"brightness(0.9)"}} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}> */}
            <div className="box" style={{marginTop:"4pt",padding:"6pt",cursor:"default",borderColor:"red",background:"yellow",filter:"brightness(0.9)"}}>
                { !check.queueingCheckRun && <span style={{float:"right",cursor:"pointer"}} onClick={(e) => { hideCheckRunningBox(check);e.stopPropagation(); e.preventDefault(); }}></span> }
                {  check.queuedCheckRun &&
                    <small><b>
                        <span className="tool-tip" data-text="Click to view UUID for this run." onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>Queued check run</span>:&nbsp;
                        <span onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>{Time.FormatDateTime(check.queuedCheckRun + "+00:00")}</span>
                        &nbsp;{Char.RightArrow}&nbsp;
                                
                        { showUuid ? <>
                            <a className="tool-tip" data-text="Click to view in AWS S3." rel="noreferrer" target="_blank" onClick={(e) => {}} href={`https://s3.console.aws.amazon.com/s3/object/${info.get("checks.bucket")}?region=us-east-1&prefix=${check.name}/${check.queuedCheckRun}.json`} style={{color:"inherit"}}><u>{check.queuedCheckRun}</u></a>
                        </>:<>
                            <span className="tool-tip" data-text={`UUID: ${check.queuedCheckRun}`} onClick={() => setShowUuid(!showUuid)} style={{cursor:"pointer"}}>OK</span>
                        </>}
                        <div style={{float:"right",marginTop:"-0pt",cursor:"pointer"}} onClick={() => {hideCheckRunningBox(check); }}>&nbsp;{Char.X}</div>
                    </b></small>
                }
                { !check.queuedCheckRun && <div style={{marginTop:"-2pt"}}><StandardSpinner condition={check.queueingCheckRun} label={" Queueing check run"} color={"darkred"} /></div> }
            </div>
        </div>
    } 

    // What a pain ...
    const CheckRunArgsBox = ({check,update}) => {
        if (!Type.IsNonEmptyObject(check.kwargs)) {
            check.kwargs = getKwargsFromCheck(check);
        }
        return check.configuringCheckRun && <>
            <div className="box thickborder" style={{marginTop:"4pt",padding:"6pt",cursor:"default",background:"lightyellow"}} onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
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
        if (groupList.error) return <FetchErrorBox error={groupList.error} message="Error loading checks from Foursight API" />
        return <div>
            { groupList.length > 0 /* selectedGroups.length > 0 */ ? (<>
                <div style={{paddingBottom:"3pt"}}>
                    <span style={{cursor:"pointer"}} onClick={() => onClickSelectedGroupsTitle()}>
                        <b>Check Details</b>
                        { isShowingAnyGroupsResults() ? (<>
                            &nbsp;<small>{Char.DownArrowFat}</small>
                        </>):(<>
                            &nbsp;<small>{Char.UpArrowFat}</small>
                        </>)}
                    </span>
                    <span style={{float:"right",fontSize:"x-small",marginTop:"6px",color:Styles.GetForegroundColor()}}>
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
            <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"300pt"}}>
                <div>
                    <span style={{cursor:"pointer"}} onClick={() => toggleShowAllResults(group?.checks)}><b>{group?.group}</b> {isShowingAnyResults(group?.checks) ? (<small>{Char.DownArrowFat}</small>) : (<small>{Char.UpArrowFat}</small>)}</span>
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
                     <i>Queueing</i>
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
            <span style={{...style, cursor:!check.fetchingResult ? "pointer" : "not-allowed",color:"inherit",fontSize:"10pt"}} onClick={(e) => { !check.fetchingResult && refreshResults(check); e.stopPropagation(); e.preventDefault(); }}>
                <b data-text={check.results ? "Click here to fetch the latest results." : "Fetching the latest results."} className={"tool-tip"}>{Char.Refresh}</b>
            </span>
        </span>
    }

    const ToggleHistoryButton = ({check, style}) => {
        return <span style={{...style, cursor:"pointer"}} onClick={() => onClickShowHistory(check)}>
            <span data-text={"Click here to " + (check.showingHistory ? "hide" : "show") + " recent history of check runs."} className={"tool-tip"}>
                <img alt="history" onClick={(e) => {}} src={Image.History()} style={{marginBottom:"1px",height:"18"}} />
            </span>
            { check.showingHistory ? <span>{Char.RightArrow}</span> : <></> }
        </span>
    }

    const SelectedChecksBox = ({check, index}) => {
        return <div>
            <div className="box check-box" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"450pt"}}>
            <table style={{width:"100%"}}>
                <tbody>
                    <tr style={{height:"3pt"}}><td></td></tr>
                    <tr>
                        <td style={{verticalAlign:"top",width:"1%","cursor":"pointer"}} onClick={() => {toggleCheckResultsBox(check)}}>
                            <b>{ isShowingSelectedCheckResultsBox(check) ? <small>{Char.DownArrowHollow}</small> : <small>{Char.RightArrowHollow}</small> }&nbsp;</b>
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
                            <u className="tool-tip" data-text={`Check: ${check.name}. Module: ${check.module}. File: ${check.file}`} style={{cursor:"pointer",fontWeight:isShowingSelectedCheckResultsBox(check) ? "bold" : "normal"}} onClick={() => {onClickShowHistory(check);}}>{check.title}</u>
                            { check.registered_github_url && <>
                                <a className="tool-tip" data-text="Click here to view the source code for this check." style={{marginLeft:"6pt",marginRight:"6pt"}} rel="noreferrer" target="_blank" href={check.registered_github_url}><img alt="github" src={Image.GitHubLoginLogo()} height="18"/></a>
                            </>}
                            <ToggleHistoryButton check={check} />
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
                            <CheckRunArgsBox check={check} update={() => noteChangedCheckBox()}/>
                            {/* ACTION BEGIN */}
                            <RunActionBox check={check} update={() => groupList.update()} />
                            {/* ACTION END */}
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
        return <pre className="box lighten" style={{color:check.results?.status?.toUpperCase() === "PASS" ? "inherit" : "darkred",wordWrap:"break-word",paddingBottom:"4pt",marginBottom:"3px",marginTop:"3px",marginRight:"5pt",minWidth:"360pt",maxWidth:"100%"}}>
            <div style={{float:"right",marginTop:"-10px"}}>
            <span style={{fontSize:"0",opacity:"0"}} id={check.name}>{Json.Str(check.showingResultDetailsFull ? check.results.full_output : check.results)}</span>
            <img alt="copy" onClick={() => Clipboard.Copy(check.name)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
            &nbsp;<span style={{fontSize:"x-large",cursor:"pointer",color:"black"}} onClick={() => {check.showingResultDetailsFull = !check.showingResultDetailsFull; noteChangedResults(); } }>{check.showingResultDetailsFull ? <span title="Show full results output.">{Char.UpArrow}</span> : <span>{Char.DownArrow}</span>}</span>
            &nbsp;<span style={{fontSize:"large",cursor:"pointer",color:"black"}} onClick={() => { check.showingResultDetails = false ; noteChangedResults(); }}>X</span>
            </div>
            {!check.results ? <StandardSpinner condition={!check.results} color={Styles.GetForegroundColor()} label={"Loading results"}/> : (Object.keys(check.results).length > 0 ? (Yaml.Format(check.showingResultDetailsFull ? check.results.full_output : check.results)) : <div style={{marginTop:"1pt"}}>No results.</div>) }
        </pre>
    }

    const ResultBox = ({check}) => {
        return <div>
            { check.results && <small style={{color:check.results?.status?.toUpperCase() === "PASS" ? "inherit" : "red",cursor:"pointer"}} onClick={() => { check.showingResultDetails = !check.showingResultDetails ; noteChangedResults(); }}>
                { Object.keys(check.results).length > 0 ? (<>
                    { <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div> }
                    <span className="tool-tip" data-text={Time.FormatDuration(check.results?.timestamp, new Date(), true, null, null, "ago")}>Latest Results: {check.results?.timestamp}</span>
                        { check.showingResultDetails ? (
                            <b className={"tool-tip"} data-text={"Click to hide result details."}>&nbsp;{Char.DownArrow}</b>
                        ):(
                            <b className={"tool-tip"} data-text={"Click to show result details."}>&nbsp;{Char.UpArrow}</b>
                        )}
                    <RefreshResultButton check={check} style={{marginLeft:"4pt"}} />
                    <br />
                    <span style={{color:check.results?.status?.toUpperCase() === "PASS" ? "inherit" : "red"}}><span className={"tool-tip"} data-text={"Click to " + (check.showingResultDetails ? "hide" : "show") + " result details."}>Results Summary</span>: {check.results?.summary}</span>&nbsp;&nbsp;
                    { check.results?.status?.toUpperCase() === "PASS" ? (<b style={{fontSize:"12pt",color:"inherit"}}>{Char.Check}</b>) : (<b style={{fontSize:"13pt",color:"red"}}>{Char.X}</b>) }
                </>):(<>
                    { !check.showingResultDetails && <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div> }
                    { !check.showingResultDetails && <span>No recent results.<RefreshResultButton check={check} style={{marginLeft:"4pt"}} /></span> } 
                </>)}
            </small> }
            {/* Results details or loading results box */}
            { check.showingResultDetails ? <>
                            <div style={{height:"2pt"}} />
                <ResultDetailsBox check={check} />
            </>:<>
                { !check.results && <div style={{height:"1px",marginTop:"8px",marginBottom:"2px",background:"gray"}}></div> }
                { !check.results && <StandardSpinner condition={!check.results} color={Styles.GetForegroundColor()} label={"Loading latest result"} /> }
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
                <span style={{float:"right",cursor:"pointer"}} onClick={(() => {hideHistory(check)})}>&nbsp;&nbsp;<b>{Char.X}</b></span>
            </div>
            <div style={{marginBottom:"6pt"}}/>
            { check.showingHistory && (<>
                { check.history?.list?.length > 0 ? (<>
                    <table style={{width:"100%"}}>
                        <TableHead columns={columns} list={check.history.list} refresh={() => refreshHistory(check)} update={(e) => historyList.update()} style={{color:Styles.GetForegroundColor(),fontWeight:"bold"}} lines={true} />
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
                                <span onClick={() => {toggleHistoryResult(check, history, extractUuid(history)); }} style={{cursor:"pointer"}}>{extractTimestamp(history)}</span>
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
                        <div style={{color:"black", borderTop:"1px solid"}}>No history.</div>
                    </>):(<>
                        <div style={{color:"black", borderTop:"1px solid"}} />
                        <StandardSpinner condition={!check.history} color={Styles.GetForegroundColor()} label="Loading history" />
                    </>)}
                </>)}
            </>)}
        </div>
    }

    const ResultsHistoryPanel = () => {
        // let histories = selectedHistories?.filter((check) => check.showingHistory);
        let histories = historyList.filter((check) => check.showingHistory);
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
            historyList.prepend(check);
            if (!check.history) {
                historyList.refresh({
                    url: Server.Url(`/checks/${check.name}/history`, environ),
                    onData: (data, current) => {
                        check.history = data;
                        return current;
                    }
                });
            }
        }
    }

    function showHistoryResult(check, history, uuid) {
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

    function hideHistoryResult(history) {
        history.__resultShowing = false;
        history.__result = null;
        history.__resultLoading = false;
//      history.__resultError = false;
        historyList.update();
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
            historyList.remove(index);
        }
    }

    function findResultsHistoryIndex(check) {
        for (let i = 0 ; i < historyList.length ; i++) {
            const selectedHistory = historyList.get(i)
            if (selectedHistory.name === check.name) {
                return i;
            }
        }
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
            groupList.refresh({
                url: Server.Url(`/checks/${check.name}`, environ),
                onData: (data, current) => {
                    check.results = data;
                    check.fetchingResult = false;
                    return current;
                }
            });
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
           &nbsp;<span style={{fontWeight:isShowingChecksRaw() ? "bold" : "normal"}} onClick={() => toggleChecksRaw()}>View Raw Checks</span> <br />
        </>
    }

    const ChecksRawView = () => {
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
                                        <span style={{cursor:"pointer"}} onClick={() => onClickShowHistory(findCheck(run.check, run.group))}>{run.title}</span> <br />
                                        <i><small style={{cursor:"pointer"}} onClick={() => toggleShowGroup(findGroup(run.group))}>{run.group}</small></i>&nbsp;
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

    //

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
                                                    <b style={{color:Styles.GetForegroundColor(),cursor:"pointer"}} onClick={() => onClickShowHistory(findCheck(lambda_check.check_name, lambda_check.check_group))}>{lambda_check.check_title}</b> <br />
                                                    <i style={{color:Styles.GetForegroundColor(),cursor:"pointer"}} onClick={() => toggleShowGroup(findGroup(lambda_check.check_group))}>{lambda_check.check_group}</i>
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
                        <ChecksRawView />
                        <SelectedGroupsPanel />
                    </td>
                    <td style={{paddingLeft: (groupList?.length > 0 || groupList.error || isShowingChecksRaw()) ? "10pt" : "0",verticalAlign:"top"}}>
                        <LambdasView />
                        <RecentRunsView />
                        <ResultsHistoryPanel />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
};

// This is outside because finally starting to factor out into independent components.
const RunActionBox = ({ check, update }) => {
    const [ confirmRun, setConfirmRun ] = useState(false);
    function onClickRunAction() {
        if (check.__confirmRunAction) {
            // 
            // TODO
            //
            check.__confirmRunAction = false;
            check.__runAction = true;
        }
        else {
            check.__confirmRunAction = true;
            check.__runAction = false;
        }
        update();
    }
    function onClickRunActionCancel() {
        check.__confirmRunAction = false;
        check.__runAction = false;
        update();
    }
    function onClickRunActionResultClose() {
        check.__confirmRunAction = false;
        check.__runAction = false;
        update();
    }
    return <>
        { check.configuringCheckRun && check.results && check.results.action && <>
            <div className="box thickborder" style={{background:"lightyellow",fontSize:"small",marginTop:"4pt",paddingTop:"8pt",paddingBottom:"8pt"}}>
                <div style={{marginTop:"0pt"}}>
                    <b>Action</b>: <span className="tool-tip" data-text={check.results.action}>{check.results.action_title}</span>
                        <div style={{float:"right",marginTop:"-2pt"}}>
                            {check.results.allow_action ? <>
                                <button className="check-run-button" style={{background:check.__confirmRunAction ? "red" : "inhert"}} onClick={onClickRunAction}>{Char.RightArrowFat} Run Action</button>
                            </>:<>
                                <button className="check-run-button" disabled={true}>Disabled</button>
                            </>}
                        </div>
                </div>
                { check.__confirmRunAction && <>
                    <div style={{border:"1px solid",marginTop:"8pt",marginBottom:"8pt"}} />
                    <i><b>Are you sure you want to run this action?</b></i>
                    <span className="check-action-confirm-button" style={{float:"right",marginTop:"-2pt"}} onClick={onClickRunActionCancel}>&nbsp;<b>Cancel</b></span>
                </>}
                { check.__runAction && <>
                    <div style={{border:"1px solid",marginTop:"8pt",marginBottom:"8pt"}} />
                    <b style={{float:"right",cursor:"pointer"}} onClick={onClickRunActionResultClose}>{Char.X}&nbsp;</b>
                    <i><b>Running actions are not yet supported ...</b></i>
                </>}
            </div>
        </>}
    </>
}

export default ChecksPage;
