import React from 'react';
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { StandardSpinner } from '../../Spinners';
import { useFetch } from '../../utils/Fetch';
import { ExternalLink } from '../../Components';
import Char from '../../utils/Char';
import Clipboard from '../../utils/Clipboard';
import Client from '../../utils/Client';
import Json from '../../utils/Json';
import Tooltip from '../../components/Tooltip';
import Type from '../../utils/Type';
import Yaml from '../../utils/Yaml';
import Uuid from 'react-uuid';
import { useComponentDefinitions, useSelectedComponents } from '../../Hooks.js';
//import { useKeyedState, useOptionalKeyedState } from '../../Hooks.js';
import useKeyedState from '../../hooks/KeyedState';
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

    //const keyedState = useKeyedState();
    const keyedState = useKeyedState();

    const componentDefinitions = useComponentDefinitions([
         { type: "group", create: createGroup },
    ]);

    const componentsLeft = useSelectedComponents(componentDefinitions);
    const componentsRight = useSelectedComponents(componentDefinitions);

    function createGroup(name, key, unselect, args) {
        const { keyedState, checks } = args;
        return <Group
            groupName={name}
            env={environ}
            parentState={keyedState.keyed(key)}
            groupChecks={checks}
            close={unselect}
        />
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
    const toggleGroup     = (groupName, args) => componentsLeft.toggle("group", groupName, args);

    return <table><tbody><tr>
        <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
            <GroupList
                toggle={toggleGroup}
                isSelected={isSelectedGroup}
            />
        </td>
        { !componentsLeft.empty() &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                { componentsLeft.map((component, i) => <div key={component.key} style={{marginTop:"0",marginBottom:"0"}}>{component.ui({ keyedState: keyedState })}</div>) }
            </td>
        }
        { !componentsRight.empty() &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                { componentsRight.map(component => <div key={component.key}>{component.ui({ keyedState: keyedState })}</div>) }
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
            {!groups.loading && groups.data.map((group, i) => {
                const toggle = () => props.toggle(group.group, { checks: group.checks });
                const isSelected = () => props.isSelected(group.group);
                const style = i + 1 < groups.length ? styleNotLast : styleLast;
                return <div key={group.group} style={style} onClick={toggle}>
                    <span id={`tooltip-${group.group}`} style={{fontWeight: isSelected(group.name) ? "bold" : "inherit"}}>{group.group}</span>&nbsp;&nbsp;<small>({group.checks.length})</small>
                    <Tooltip id={`tooltip-${group.group}`} text={`Click to view (${group.checks.length}) group checks.`} />
                </div>
            })}
        </div>
    </>
}

const Group = (props) => {
    // TODO: how to pass in showBrief - do this if click on (say) the number of checks per group rather than the group name
    const { groupName, groupChecks, env, parentState, showBrief, close } = props;
    //const [ state, setState ] = useOptionalKeyedState(parentState, { showBriefList: showBrief ? groupChecks.map(check => check.name) : []});
    const [ state, setState ] = useKeyedState(parentState, { showBriefList: showBrief ? groupChecks.map(check => check.name) : []});
    const title = groupName.replace(/ checks$/i, "") + " Group";
    const isShowBrief = (checkName) => state.showBriefList?.find(item => item === checkName);
    const isShowBriefAny = () => state.showBriefList?.length > 0;
    const isShowBriefAll = () => state.showBriefList?.length === groupChecks.length;
    const setShowBriefAll = () => { setState({ showBriefList: groupChecks.map(check => check.name) }); }
    const setShowBriefNone = () => setState({ showBriefList: [] }); 
    const toggleShowBrief = (checkName) => {
        isShowBrief(checkName) ?
            setState({ showBriefList: state.showBriefList.filter(item => item !== checkName) })
        :   setState({ showBriefList: [...(state.showBriefList || []), checkName] });
    }
    const toggleShowBriefAll = () => {
        !isShowBriefAll() ? setShowBriefAll() : setShowBriefNone();
    }
    return <>
        <div>&nbsp;</div>
        <div className="box" style={{marginBottom:"-6pt",whiteSpace:"nowrap"}}>
            <div style={{marginBottom:"4pt",cursor:"pointer"}} onClick={toggleShowBriefAll}>
                <b>{title}</b>&nbsp;
                <small>{!isShowBriefAll() ? <span>{Char.DownArrowFat}</span> : Char.UpArrowFat}</small>
                <div style={{float:"right",marginTop:"-1pt",fontSize:"small",cursor:"pointer"}} onClick={close}><b>{Char.X}</b></div>
            </div>
            {groupChecks.map((check, i) => {
                const style = i > 0 ? { marginTop: isShowBriefAll() ? "3pt" : "6pt" } : {};
                const toggleBrief = () => toggleShowBrief(check.name);
                if (isShowBrief(check.name)) {
                    return <CheckBrief
                        key={i}
                        check={check}
                        toggleBrief={toggleBrief} style={style}
                    />
                }
                else {
                    return <Check
                        key={i}
                        check={check} env={env} parentState={parentState?.keyed(check.name)}
                        lightenOnHover={true} onCollapse={toggleBrief}
                        style={style} width="100%"
                    />
                }
            })}
        </div>
    </>
}

const CheckBrief = (props) => {
    const { check, toggleBrief, style = {} } = props;
    return <div className="box darken check-box" style={style}>
        <span className="pointer" onClick={toggleBrief}><b><small>{Char.UpArrowHollow}</small> {check.title}</b></span>
        <ExternalLink
            href={Client.Path(`/checks/${check.name}/history`)}
            bold={true}
            tooltip="Click to view check details and history (in new tab)."
            style={{float:"right",marginTop:"1pt",marginLeft:"8pt"}} />
    </div>
}


export default TestChecksPage;
