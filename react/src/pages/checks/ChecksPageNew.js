import axios from 'axios';
import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Uuid from 'react-uuid';
import { RingSpinner, PuffSpinnerInline, StandardSpinner } from '../../Spinners';
import useReadOnlyMode from '../../hooks/ReadOnlyMode';
import useFetch from '../../hooks/Fetch';
import { FetchErrorBox } from '../../Components';
import Char from '../../utils/Char';
import Clipboard from '../../utils/Clipboard';
import Client from '../../utils/Client';
import Env from '../../utils/Env';
import Image from '../../utils/Image';
import Json from '../../utils/Json';
import Server from '../../utils/Server';
import Str from '../../utils/Str';
import TableHead from '../../TableHead';
import Time from '../../utils/Time';
import Type from '../../utils/Type';
import Yaml from '../../utils/Yaml';
import LiveTime from '../../LiveTime';
import Styles from '../../Styles';

const Groups = (props) => {
    return <>
        <b>Check Groups</b>
        <div className="box margin" style={{whiteSpace:"nowrap"}}>
            { props.groups.data?.map((group, index) => <div key={group.group}>
                { props.selected(group) ? <>
                    <b className="pointer" onClick={() => {props.toggle(group)}}>{group.group}</b>
                </>:<>
                    <span className="pointer" onClick={() => {props.toggle(group)}}>{group.group}</span>
                </>}
                <br />
            </div>)}
        </div>
    </>
}

const SelectedGroups = (props) => {
    const [ showResult, setShowResult ] = useState(true);
    return <>
        <div className="pointer" onClick={() => setShowResult(!showResult)}>
            <b>Checks</b>
            &nbsp;<small>{ showResult ? <>{Char.DownArrowFat}</> : <>{Char.UpArrowFat}</> }</small>
        </div>
        { props.groups?.length > 0 ? <>
            { props.groups.filter(group => props.selected(group))?.map((group, index) => <div key={group.group}>
                <div className="box margin" style={{maxWidth:"800pt"}}>
                    <SelectedGroup group={group} update={props.update} showResult={showResult} />
                </div>
                <div style={{height:"6pt"}} />
            </div>)}
        </>:<>
            <div className="box margin">
                No check groups selected.
            </div>
        </>}
    </>
}

const SelectedGroup = (props) => {
    const [ showResult, setShowResult ] = useState(props.showResult);
    useEffect(() => {
        setShowResult(props.showResult);
    }, [props.showResult]);
    return <>
        <b className="pointer" onClick={() => {setShowResult(!showResult)}}>{props.group.group}</b>
        { props.group?.checks?.map((check, index) => <div key={check.name}>
             <SelectedGroupCheck check={check} index={index} update={props.update} showResult={showResult} />
            { index < props.group.checks?.length - 1 && <div style={{height:"6pt"}} /> }
        </div>)}
    </>
}

const SelectedGroupCheck = (props) => {
    const [ showResult, setShowResult ] = useState(props.showResult);
    function toggleShowResult() {
        setShowResult(!showResult);
    }
    useEffect(() => {
        setShowResult(props.showResult);
    }, [props.showResult]);
    return <>
        <div className="box margin darken">
            <table style={{width:"100%"}}><tbody><tr>
            <td className="pointer" style={{width:"1%",verticalAlign:"top"}}>
                <small onClick={toggleShowResult}><b>{showResult ? Char.DownArrowHollow : Char.RightArrowHollow}</b>&nbsp;</small>
            </td>
            <td>
                <u onClick={toggleShowResult} className="tool-tip pointer" data-text={props.check.name} style={{fontWeight:showResult ? "bold" : "inherit"}}>{props.check.title}</u> <br />
                { Object.keys(props.check?.schedule).map((key, index) => <span key={key}>
                    { Str.HasValue(props.check.schedule[key]?.cron_description) ? (
                        <div style={{whiteSpace:"nowrap",width:"100%"}} key={index} title={props.check.schedule[key].cron}>
                            <small><i>Schedule: <span className={"tool-tip"} data-text={props.check.schedule[key]?.cron}>{props.check.schedule[key].cron_description}</span></i></small>
                        </div>
                    ):(
                        <small><i>
                            Not scheduled.
                        </i></small>
                    )}
                </span>)}
                <SelectedGroupCheckResult check={props.check} update={props.update} showResult={showResult} />
            </td>
            </tr></tbody></table>
        </div>
    </>
}

const SelectedGroupCheckResult = (props) => {

    const result = useFetchResult(props.check);
    const [ showResultDetail, setShowResultDetail ] = useState(false);

    function useFetchResult(check) {
        return useFetch({ url: Server.Url(`/checks/${check.name}`), nofetch: true, cache: true });
    }

    function fetchResult(refresh = false) {
        result.fetch();
    }

    function refreshResult() {
        fetchResult(true);
    }

    function onClickResultTitle() {
        if (!result.empty) {
            setShowResultDetail(!showResultDetail);
        }
        else {
            fetch();
        }
    }

    useEffect(() => {
        if (props.showResult) {
            fetchResult();
        }
    }, [props.check, props.showResult]);

    if (!props.showResult) return <></>
    return <>
        { result.loading ? <>
            <div style={{height:"1px",marginTop:"4pt",marginBottom:"2pt",background:Styles.GetForegroundColor()}} />
            <StandardSpinner condition={result?.loading} color={Styles.GetForegroundColor()} label={"Loading latest result"} />
        </>:<>
            { props.showResult && <>
                <div style={{fontSize:"small",marginTop:"4pt",paddingTop:"4pt",borderTop:"1px solid"}}>
                    <span className="pointer" onClick={onClickResultTitle}>
                        <b>Latest Result</b>
                        { !result.empty && <>
                            &nbsp;<b>{showResultDetail ? Char.DownArrow : Char.UpArrow}</b>
                            { result.get("timestamp") && <>&nbsp;{result.get("timestamp")}</>}
                        </>}
                    </span>
                    &nbsp;|&nbsp;<b className="pointer" onClick={refreshResult}>{Char.Refresh}</b>
                    <br />
                    { !result.empty ? <>
                        Summary: {result.get("summary") || result.get("description") || 'No result summary.'}
                    </>:<>
                        No results.
                    </>}
                </div>
            </>}
        </>}
    </>
}

const ChecksPageNew = (props) => {

    const groups = useFetch();
    const [ selectedGroups, setSelectedGroups ] = useState([])

    useEffect(() => {
        groups.fetch({
            url: Server.Url("/checks/grouped"),
            onData: (data) => {
                data.sort((a,b) => a.group > b.group ? 1 : (a.group < b.group ? -1 : 0));
                if (data.length > 0) {
                    //
                    // Choose some group as default to show.
                    //
                    let group = data.find(item => item.group.toLowerCase().includes("maintenance"));
                    if (group) selectGroup(group);
                }
            }
        });
    }, []);

    function isSelectedGroup(group) {
        return selectedGroups.find(selectedGroup => selectedGroup.group === group.group) !== undefined;
    }

    function toggleSelectedGroup(group) {
        if (isSelectedGroup(group)) {
            unselectGroup(group);
        }
        else {
            selectGroup(group);
        }
    }

    function selectGroup(group) {
        if (!isSelectedGroup(group)) {
            selectedGroups.unshift(group);
            updateSelectedGroup();
        }
    }

    function unselectGroup(group) {
        const index = selectedGroups.findIndex(selectedGroup => selectedGroup.group === group.group);
        if (index >= 0) {
            selectedGroups.splice(index, 1);
            updateSelectedGroup();
        }
    }

    function updateSelectedGroup() {
        setSelectedGroups([...selectedGroups])
    }

    function updateCheck(check) {
        updateSelectedGroup();
    }

    return <>
        <div>
            <table><tbody>
                <tr>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <Groups groups={groups} selected={isSelectedGroup} toggle={toggleSelectedGroup} />
                    </td>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <SelectedGroups groups={selectedGroups} selected={isSelectedGroup} update={updateCheck} />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
}

export default ChecksPageNew;
