import React from 'react';
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { StandardSpinner } from '../../Spinners';
import { useFetch } from '../../utils/Fetch';
import { ExternalLink } from '../../Components';
import Char from '../../utils/Char';
import Clipboard from '../../utils/Clipboard';
import Json from '../../utils/Json';
import Type from '../../utils/Type';
import Yaml from '../../utils/Yaml';
import Uuid from 'react-uuid';
import { useComponentDefinitions, useSelectedComponents } from '../../Hooks.js';
import { useKeyedState, useOptionalKeyedState } from '../../Hooks.js';
import Check from '../checks/Check';
import CheckWithFetch from '../checks/CheckWithFetch';

const tdLabelStyle = {
    color: "var(--box-fg)",
    fontWeight: "bold",
    paddingTop: "1pt",
    verticalAlign: "top",
    ChecksPage: "5%",
    paddingRight: "8pt",
    whiteSpace: "nowrap"
}
const tdContentStyle = {
    verticalAlign: "top",
}

const TestChecksPage = () => {

    const { environ } = useParams();

    const keyedState = useKeyedState();

    const componentDefinitions = useComponentDefinitions([
         { type: "check", create: createCheck },
         { type: "group", create: createGroup },
    ]);

    const componentsLeft = useSelectedComponents(componentDefinitions);
    const componentsRight = useSelectedComponents(componentDefinitions);

    function createGroup(name, key, keyedState, unselect, additionalArgs) {
        const checks = additionalArgs;
        return <Group groupName={name} env={environ} parentState={keyedState.keyed(key)} groupChecks={checks} />
    }

    function createCheck(name, key, keyedState, unselect) {
        return <CheckWithFetch checkName={name} env={environ} parentState={keyedState.keyed(key)} />
    }

    const BoxWrapper = ({ title, close, children }) => {
        return <div style={{marginBottom:"8pt"}}>
            <div>
                <b>{title}</b>
                { close && <small onClick={close} className="pointer" style={{float:"right",marginRight:"6pt"}}><b>{Char.X}</b></small> }
            </div>
            {children}
       </div>
    }

    const isSelectedGroup = (groupName) => componentsLeft.selected("group", groupName);
    const toggleGroup     = (groupName, checks) => componentsLeft.toggle("group", groupName, keyedState, checks);
    const isSelectedCheck = (checkName) => componentsLeft.selected("check");
    const toggleCheck     = (checkName) => componentsLeft.toggle("check", checkName, keyedState);

    useEffect(() => {
    }, []);

    return <table><tbody><tr>
        <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
            <GroupList
                toggle={toggleGroup}
                isSelected={isSelectedGroup}
            />
        </td>
        { !componentsLeft.empty() &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                { componentsLeft.map((component, i) => <div key={component.key}>{component.ui(keyedState)}</div>) }
            </td>
        }
        { !componentsRight.empty() &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                { componentsRight.map(component => <div key={component.key}>{component.ui(keyedState)}</div>) }
            </td>
        }
    </tr></tbody></table>
}

const GroupList = (props) => {
    const groups = useFetch("/checks/grouped", { cache: true, loading: true });
    const styleLast = { cursor: "pointer" };
    const styleNotLast = { ...styleLast, borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt" };
    return <>
        <div><b>Check Groups</b></div>
        <div className="box" style={{whiteSpace:"nowrap"}}>
            { groups.loading && <StandardSpinner label="Loading check groups" /> }
            {!groups.loading && groups.data && groups?.data?.map((group, i) => {
                const toggle = () => props.toggle(group.group, group.checks);
                const isSelected = () => props.isSelected(group.group);
                const style = {...(i + 1 < groups.length ? styleNotLast : styleLast), ...(isSelected(group.name) ? {fontWeight:"bold"} : {})};
                return <div key={group.group} style={style} onClick={toggle}>
                   {group.group}
                </div>
            })}
        </div>
    </>
}

const Group = (props) => {
    const { groupName, groupChecks, env, parentState } = props;
    const [ state, setState ] = useOptionalKeyedState(parentState);
    const title = groupName.replace(/ checks$/i, "") + " Group";
    const isShowBrief = (checkName) => state.showBriefList?.find(item => item === checkName);
    const isShowAnyBrief = () => state.showBriefList?.length > 0;
    const setShowAllBrief = () => { setState({ showBriefList: groupChecks.map(check => check.name) }); }
    const setShowNoneBrief = () => setState({ showBriefList: [] }); 
    const toggleShowBrief = (checkName) => {
        if (isShowBrief(checkName)) {
            setState({ showBriefList: state.showBriefList.filter(item => item !== checkName) });
        }
        else {
            //state.showBriefList = [...(state.showBriefList || []), checkName]
            //setState({ showBriefList: state.showBriefList });
            setState({ showBriefList: [...(state.showBriefList || []), checkName] });
        }
    }
    return <>
        <b>Checks</b>
        <div className="box" style={{whiteSpace:"nowrap"}}>
            <div style={{marginBottom:"4pt",cursor:"pointer"}} onClick={() => isShowAnyBrief() ? setShowNoneBrief() : setShowAllBrief()}>
                <b>{title}</b>&nbsp;
                <small>{isShowAnyBrief() ? <span>{Char.UpArrowFat}</span> : Char.DownArrowFat}</small>
            </div>
            {groupChecks.map((check, i) => {
                if (isShowBrief(check.name)) {
                    const style = i > 0 ? { marginTop:"3pt" } : {};
                    return <div className="box darken" style={style}>
                        <small className="pointer" onClick={() => toggleShowBrief(check.name)}><b>{Char.UpArrowHollow} {check.title}</b></small>
                    </div>
                }
                else {
                    const style = i > 0 ? { marginTop:"6pt" } : {};
                    return <div style={style}>
                        <Check check={check} env={env} parentState={parentState.keyed("asdfasdf"+check.name)} lightenOnHover={true} onCollapse={() => toggleShowBrief(check.name)}/>
                    </div>
                }
            })}
        </div>
    </>
}


export default TestChecksPage;
