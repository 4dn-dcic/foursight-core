import React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Char from '../utils/Char'; 
import DateTime from '../utils/DateTime';
import Duration from '../utils/Duration';
import { ExternalLink } from '../Components'; 
import Image from '../utils/Image';
import { PuffSpinnerInline, StandardSpinner } from '../Spinners';
import Tooltip from '../components/Tooltip';
import useFetch from '../hooks/Fetch';
import useFetchFunction from '../hooks/FetchFunction';
import useHeader from '../hooks/Header';

const region = "us-east-1";

function awsTaskRunLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/task-definitions/${id}/run-task`;
}

function awsTaskLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/task-definitions/${id}`;
}

function awsTaskRunningLink(cluster, id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${cluster}/tasks/${id}/logs`;
}

function awsClusterLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${id}/services?region=${region}`;
}

function awsVpcLink(id) {
    return `https://${region}.console.aws.amazon.com/vpc/home?region=${region}#VpcDetails:VpcId=${id}`;
}

function awsSecurityGroupLink(id) {
    return `https://${region}.console.aws.amazon.com/vpc/home?region=${region}#SecurityGroup:groupId=${id}`;
}

function awsSubnetLink(id) {
    return `https://${region}.console.aws.amazon.com/vpc/home?region=${region}#SubnetDetails:subnetId=${id}`;
}

function errorsExist(task) {
    if (!task?.task_cluster ||
        !task?.task_vpc ||
        !task?.task_subnets ||
        !task?.task_security_group) {
        return true;
    }
    return false;
}

const useTaskStatus = (task, refresh) => {
    return useFetch(`//aws/ecs/task_running/${task.task_cluster.name}/${task.task_arn}`, {cache: true});
}

const useTaskStatusNoCache = (task, refresh) => {
    return useFetch(`//aws/ecs/task_running/${task.task_cluster.name}/${task.task_arn}`);
}

const taskNames = [
    { name: "deploy",         label: "Reindex" },
    { name: "deploy_initial", label: "Initial Deploy" },
    { name: "indexer",        label: "Indexer" },
    { name: "ingester",       label: "Ingester" },
    { name: "portal",         label: "Instance" }
];

const getTaskLabel = (taskName) => taskNames.find(task => task.name == taskName).label;

const PortalReindexPage = (props) => {

    const [args, setArgs] = useSearchParams();
    const [taskName, setTaskName] = useState(args.get("task") || "deploy");

    const tasks = useFetch(`//aws/ecs/tasks_for_run?task=${taskName}`, {
        onData: (data) => {
            setShowDetails(data.reduce((result, task) => {
                result[task.task_arn] = false;
                return result;
            }, {}));
            return data;
        }
    });

    // The top-level up/down arrow toggle can be used to expand/collapse task ("env") details;
    // if ANY of the task details are expanded, then the top-level toggle collapses all of them;
    // if NONE of the task details are expanded, then the top-level toggle expands all of them.

    const [showDetails, setShowDetails] = useState({});
    const isShowDetails = () => { for (const key of Object.keys(showDetails)) if (showDetails[key]) return true; return false; }
    const toggleShowDetails = () => {
        const showDetail = isShowDetails();
        for (const key of Object.keys(showDetails)) showDetails[key] = !showDetail;
        setShowDetails({...showDetails});
    }
    const toggleShowDetail = (task) => { showDetails[task.task_arn] = !showDetails[task.task_arn]; setShowDetails({...showDetails}); }
    const setShowDetail = (task) => { showDetails[task.task_arn] = true; setShowDetails({...showDetails}); }
    const isShowDetail = (task) => showDetails[task.task_arn];

    const onTaskChange = (taskName) => {
        setTaskName(taskName);
        setArgs({...args, "task": taskName});
    }

    return <>
        <div className="container">
            <div>
                <b style={{fontSize: "x-large"}}>Portal {getTaskLabel(taskName)}</b>
                <div style={{float: "right", marginRight: "4pt"}}>
                    <TaskSelector onTaskChange={onTaskChange} taskName={taskName} />
                </div>
            </div>
            { tasks.loading ?
                <ContentLoading />
            : <>
                <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
                    Select the Portal environment below to reindex.
                    <span style={{float: "right"}} className="pointer" onClick={toggleShowDetails} id="tooltip-show-envs">
                        { isShowDetails() ? <b>{Char.DownArrow}</b> : <b>{Char.UpArrow}</b> }
                        <Tooltip id="tooltip-show-envs" position="top" size="small"
                            text={`Click to ${isShowDetails() ? "hide" : "show"} details for task run.`} />
                    </span>
                </div>
                <Content
                    tasks={tasks.data}
                    isShowDetail={isShowDetail}
                    toggleShowDetail={toggleShowDetail}
                    setShowDetail={setShowDetail} />
            </> }
        </div>
    </>
}

const TaskSelector = (props) => {
    const [showTaskSelector, setShowTaskSelector] = useState(false);
    const onChange = (e) => {
        props.onTaskChange(e.target.value);
    }
    return <div style={{marginTop: "6pt"}}>
        { showTaskSelector ? <div onMouseLeave={() => setShowTaskSelector(false)}>
            <select style={{fontSize: "small", fontWeight: "bold"}} onChange={onChange}>
                { taskNames.map(item => item.name).map(taskName => <>
                    <option value={taskName} selected={taskName == props.taskName}>Portal {taskNames.find(task => task.name == taskName)?.label}</option>
                </> )}
            </select>
        </div>:<div onMouseOver={() => setShowTaskSelector(true)}>
            <img src={Image.SettingsIcon()} style={{height: "18px"}} />
        </div> }
    </div>
}

const ContentLoading = (props) => {
    return <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
        <StandardSpinner />
    </div>
}

const Content = (props) => {

    const [selectedTask, setSelectedTask] = useState();
    const selectTask = (task) => { isSelectedTask(task) ? setSelectedTask(null) : setSelectedTask(task.task_arn); }
    const isSelectedTask = (task) => selectedTask == task.task_arn;
    const unselectTask = () => setSelectedTask(null);

    const sortedTasks = props.tasks?.sort((a, b) => {
        a = a.task_env?.name?.toLowerCase();
        b = b.task_env?.name?.toLowerCase();
        return (a < b) ? -1 : ((a > b) ? 1 : 0);
    });

    return <div className="box" style={{paddingTop: "12pt"}}>
        { sortedTasks?.map(task =>
            <PortalReindexBox
                task={task}
                selectedTask={selectedTask}
                selectTask={selectTask}
                unselectTask={unselectTask}
                isSelectedTask={isSelectedTask}
                isShowDetail={props.isShowDetail}
                toggleShowDetail={props.toggleShowDetail}
                setShowDetail={props.setShowDetail} />
        )}
    </div>
}

const PortalReindexBox = (props) => {

    const showDetailOnSelect = false;
    const [ showDetail, setShowDetail ] = useState(false);
    const isShowDetail = () => props.isShowDetail(props.task);
    const toggleShowDetail = (e) => {
        props.toggleShowDetail(props.task);
        e.stopPropagation(); e.preventDefault();
    }
    const isSelectedTask = () => props.isSelectedTask(props.task);
    const selectTask = () =>  {
        props.selectTask(props.task);
        if (showDetailOnSelect) props.setShowDetail(props.task);
    }

    return <div onClick={selectTask} style={{marginTop:"4pt"}} className="hover-lighten">
        <table style={{width: "100%"}}><tbody><tr><td style={{verticalAlign: "top", paddingRight:"10pt", width: "1%"}}>
            <input
                name="radio"
                type="radio"
                value={props.task?.task_arn}
                checked={isSelectedTask()}
                onChange={selectTask}
                style={{marginTop:"10pt"}} />
        </td><td style={{verticalAlign: "top"}}>
            <div className="box bigmarginbottom lighten" style={{cursor:"default"}}>
                <b onClick={selectTask} className="pointer" style={{color: "black", textDecoration: isShowDetail() ? "" : "underline"}}>{props.task?.task_env?.name}</b>
                <small onClick={toggleShowDetail} className="pointer" style={{marginLeft:"4pt"}} id={`tooltip-show-env-${props.task?.task_arn}`}>
                    {isShowDetail() ? <b>{Char.DownArrow}</b> : <b>{Char.UpArrow}</b>}
                </small>
                <Tooltip id={`tooltip-show-env-${props.task?.task_arn}`} position="top" size="small"
                    text={`Click to ${isShowDetail() ? "hide" : "show"} details for task run.`} />
                <small style={{float: "right"}}>
                    &nbsp;&nbsp;<ExternalLink href={props.task.task_env?.portal_url} />
                </small>
                { (props.task?.task_env?.is_production || props.task?.task_env?.is_staging || props.task?.task_env?.color) &&
                    <small style={{float: "right", color: props.task?.task_env?.color == "blue" ? "blue" : (props.task?.task_env?.color == "green" ? "green" : "")}}>
                        {props.task?.task_env?.is_production && <b>PRODUCTION</b>}
                        {props.task?.task_env?.is_staging && <b>STAGING</b>}
                        {props.task?.task_env?.color && <>
                            &nbsp;({props.task?.task_env?.color?.toUpperCase()})
                        </>}
                    </small>
                }
                <br />
                { isShowDetail() && <DetailsBox env={props.task?.task_env} task={props.task} /> }
                <small id={`tooltip-${props.task.task_arn}`} style={{fontWeight: isSelectedTask() ? "bold" : "inherit"}}> { props.task?.task_arn }&nbsp;<ExternalLink href={awsTaskRunLink(props.task?.task_arn)} /> </small>
                <Warnings task={props.task} />
                <Tooltip id={`tooltip-${props.task.task_arn}`} position="right" shape="squared" size="small" text={"ARN of the AWS task definition to be run for the reindex."} />
                { isSelectedTask() && <ReindexButtonsBox task={props.task} unselectTask={props.unselectTask} /> }
            </div>
        </td></tr></tbody></table>
    </div>
}

const ReindexButtonsBox = (props) => {
    const running = useTaskStatusNoCache(props.task);
    const onClickIgnore = (e) => { e.stopPropagation(); e.preventDefault(); }
    if (errorsExist(props.task)) {
        return <ReindexButtonsBoxDisabled />
    }
    return <>
        <div className="box bigmargin" style={{background: "inherit", marginTop: "6pt", paddingTop: "8pt"}} onClick={onClickIgnore}>
            { running.loading ? <>
                 <ReindexButtonsTaskStatusLoading task={props.task} />
            </>:<>
                 <ReindexButtonsTaskStatusLoaded task={props.task} running={running} unselectTask={props.unselectTask} />
            </> }
        </div>
    </>
}

const ReindexButtonsBoxDisabled = (props) => {
    return <>
        <div className="box bigmargin" style={{background: "inherit", marginTop: "6pt", paddingTop: "8pt", color: "red"}}>
            <b>Reindexing disabled due to errors.</b>
        </div>
    </>
}

const ReindexButtonsTaskStatusLoading = (props) => {
    return <>
        <table><tbody><tr><td>
            <ReindexButton disabled={true} />
        </td><td style={{paddingLeft: "8pt"}}>
            <StandardSpinner label="Fetching task status" />
        </td></tr></tbody></table>
    </>
}

const ReindexButtonsTaskStatusLoaded = (props) => {
    const [confirmed, setConfirmed] = useState(false);
    const [running, setRunning] = useState(false);
    const [runDone, setRunDone] = useState(false);
    const [runResult, setRunResult] = useState(false);
    const fetch = useFetchFunction();
    const onClickCancel = (e) => { setConfirmed(false); e.stopPropagation(); }
    const onClickReindex = (e) => {
        if (confirmed) {
            setRunning(true);
            const url = `//aws/ecs/task_run/${props.task.task_cluster.name}/${props.task.task_arn}`;
            const payload = {
                subnets: props.task.task_subnets,
                security_group: props.task.task_security_group
            }
            fetch(url, { delay: 3000, method: "POST", payload: payload, onDone: (result) => {
                setRunning(false);
                setRunResult(result);
                setRunDone(true);
            } });
        }
        else {
            setConfirmed(true);
        }
        e.stopPropagation();
    }
    const onClickRunDoneX = (e) => {
        setRunDone(false);
        setConfirmed(false);
        props.unselectTask();
    }
    return <>
        { confirmed ? <>
            { running ? <>
                <StandardSpinner label="Kicking off task" />
            </>:<>
                { runDone ? <>
                    <b>Kicked off task {Char.RightArrow}</b> <small><u>{runResult?.data?.task_running_id}</u></small>&nbsp;
                    <small><ExternalLink href={awsTaskRunningLink(props.task.task_cluster.name, runResult?.data?.task_running_id)} /></small>
                    <div className="pointer" onClick={onClickRunDoneX} style={{float: "right", marginRight: "4pt"}}>{Char.X}</div>
                </>:<>
                    <ReindexButtonConfirmed task={props.task} onClickReindex={onClickReindex} onClickCancel={onClickCancel} running={props.running} />
                </> }
            </> }
        </>: <>
            <ReindexButton onClickReindex={onClickReindex} />
        </> }
        { (!props.running.loading && props.running.data?.task_running) && <span style={{color: "red"}}>
            <div style={{width: "100%", height: "2px", marginTop: "8pt", marginBottom: "8pt", background:"red"}} />
            <b>Warning</b>: This task appears to be already <u><b>running</b></u>. Run this <u><b>only</b></u> if you know what you are doing!
        </span> }
    </>
}

const ReindexButtonConfirmed = (props) => {
    return <table><tbody><tr>
        <td style={{verticalAlign: "top"}}>
            <CancelButton onClickCancel={props.onClickCancel} />
        </td><td style={{verticalAlign: "top", paddingLeft: "8pt"}}>
            <ReindexButton onClickReindex={props.onClickReindex} confirmed={true} />
        </td><td style={{verticalAlign: "top", paddingLeft: "0pt"}}>
            <b style={{position: "relative", bottom: "-3pt", whiteSpace: "nowrap"}}>&nbsp;&nbsp;&nbsp;{Char.LeftArrow} Are you sure you want to reindex <u>{props.task.task_env.name}</u>?</b>
        </td>
    </tr></tbody></table>
}

const ReindexButton = (props) => {
    return <div className={`check-run-button ${props.disabled && "disabled"}`} style={{width: "fit-content", border: "1px solid inherit"}} onClick={props?.onClickReindex}>
        { props.confirmed && <>&nbsp;Yes:</> }&nbsp;Reindex&nbsp;
    </div>
}

const CancelButton = (props) => {
    return <div className="check-action-confirm-button" style={{width: "fit-content", marginBottom: "-1pt"}} onClick={props.onClickCancel}>
        &nbsp;<b>Cancel</b>&nbsp;
    </div>
}

// Spacing and separtor line, horizontal/vertical, for div and table.
const TSpaceV = ({size = "6pt"}) => <td style={{width: size, whiteSpace: "nowrap"}} />
const TLineV = ({size = "1px", color = "black"}) => <td style={{width: size, background: color}} />
const TSeparatorV = ({ size = "1px"}) => <><TSpaceV size="8pt" /><TLineV size={size} /><TSpaceV size="8pt" /></>
const TSpaceH = ({size = "6pt"}) => <tr><td style={{height: size}}></td></tr>
const TLineH = ({size = "1px", color = "black", span = "2"}) => <tr><td style={{height: size, background: color, whiteSpace: "nowrap"}} colSpan={span == "max" ? "100" : span}></td></tr>
const TSeparatorH = ({size = "1px", color = "black", span = "2", double = false, top = "1pt", bottom = "1pt"}) => {
    return <>
        <TSpaceH size={top} />
        <TLineH size={size} color={color} span={span == "max" ? "100" : span} />
        { double && <>
            <TSpaceH size="1pt" />
            <TLineH size={size} color={color} span={span == "max" ? "100" : span} />
        </> }
        <TSpaceH size={bottom} />
    </>
}
const SeparatorH = ({size = "1px", color = "black", top = "8pt", bottom = "8pt"}) => <div style={{width: "100%", height: size, marginTop: top, marginBottom: bottom, background: color}} />

const DetailsBox = (props) => {
    const header = useHeader();
    const [showTasks, setShowTasks] = useState(false);
    const toggleShowTasks = () => setShowTasks(!showTasks);
    return <div className="box bigmargin marginbottom" onClick={(e) => e.stopPropagation()}><small>
        <table style={{fontSize: "inherit"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}}>
                    <AccountDetails task={props.task} />
                </td>
                <TSeparatorV />
                <td style={{verticalAlign: "top"}}>
                    <EnvNamesDetails env={props.env} />
                </td>
                <TSeparatorV />
                <td style={{verticalAlign: "top"}}>
                    <NetworkDetails task={props.task} showTasks={showTasks} toggleShowTasks={toggleShowTasks} />
                </td>
            </tr>
            <TSeparatorH span="max" top="6pt" bottom={"6pt"} />
            <tr><td colSpan="18">
                <TaskStatusLine task={props.task} />
            </td></tr>
            { showTasks && <>
               <TSeparatorH span="max" top="6pt" bottom={"8pt"} />
                <tr><td colSpan="18">
                    <TasksRunning task={props.task} />
                </td></tr>
            </> }
        </tbody></table>
    </small></div>
}

const AccountDetails = (props) => {
    const header = useHeader();
    return <table style={{fontSize: "inherit"}}><tbody>
        <tr><td colSpan="2"> AWS Account </td></tr>
        <TSeparatorH double={true} />
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Number: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> {header.app?.credentials?.aws_account_number} </td>
        </tr>
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Name: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> {header.app?.credentials?.aws_account_name} </td>
        </tr>
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Environment: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> {props.task?.task_env?.full_name} </td>
        </tr>
    </tbody></table>
}

const EnvNamesDetails = (props) => {
    const uniqueEnvNames = () => {
        const env = {};
        ["name", "full_name", "short_name", "public_name", "foursight_name"].forEach(name => {
             env[name] = props.env[name];
        });
        return Array.from(new Set(Object.values(env)))?.sort();
    }
    return <table style={{fontSize: "inherit"}}><tbody>
        <tr><td colSpan="2" style={{whiteSpace: "nowrap"}}> Environment Aliases </td></tr>
        <TSeparatorH double={true} />
        <tr>
            <td colSpan="2" style={{whiteSpace: "nowrap"}}>
                {uniqueEnvNames()?.map((env, index) => <>
                    {index > 0 && <br />} {env}
                </> )}
            </td>
        </tr>
    </tbody></table>
}

const NetworkDetails = (props) => {
    const [showNetworkNames, setShowNetworkNames] = useState(false);
    const toggleShowNetworkNames = (e) => { setShowNetworkNames(!showNetworkNames); e.stopPropagation() }
    return <table style={{fontSize: "inherit"}}><tbody>
        <tr><td /><td width="800pt"/></tr> {/* dummy to make it expand to right */}
        <tr><td colSpan="2"> AWS Network
            <span onClick={toggleShowNetworkNames} className="pointer" id={`tooltip-network-${props.task.task_arn}`} >
                &nbsp;{showNetworkNames ? <b>{Char.Diamond}</b> : <b>{Char.Trigram}</b>}
                <Tooltip id={`tooltip-network-${props.task.task_arn}`} position="top" size="small" text={`Click to view ${showNetworkNames ? "IDs" : "names"}.`}/>
            </span>
        </td></tr>
        <TSeparatorH double={true} />
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}} className="pointer" onClick={props.toggleShowTasks}>
                { props.showTasks ? <b>Cluster<small>&nbsp;</small>{Char.DownArrow}</b> : <>Cluster<small>&nbsp;</small>{Char.UpArrow}</> }
            </td>
            <td style={{verticalAlign: "top", whiteSpace: "break-all"}}>
                <span id={`tooltip-cluster-${props.task.task_arn}`} >
                    {showNetworkNames ? props.task?.task_cluster?.id : props.task?.task_cluster?.name}
                    &nbsp;<small><ExternalLink href={awsClusterLink(props.task?.task_cluster?.name)} /></small>
                </span>
            <Tooltip id={`tooltip-cluster-${props.task.task_arn}`} position="top" shape="squared" size="small"
                text={showNetworkNames ? props.task?.task_cluster?.name : props.task?.task_cluster?.id} />
            </td>
        </tr>
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> VPC: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}>
                <span id={`tooltip-vpc-${props.task?.task_arn}`}>
                    {showNetworkNames ? props.task?.task_vpc?.name : props.task?.task_vpc?.id}
                    &nbsp;<small><ExternalLink href={awsVpcLink(props.task?.task_vpc?.id)} /></small>
                </span>
            </td>
            <Tooltip id={`tooltip-vpc-${props.task.task_arn}`} position="top" shape="squared" size="small"
                text={showNetworkNames ? props.task?.task_vpc?.id : props.task?.task_vpc?.name} />
        </tr>
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Security: </td>
            <td style={{verticalAlign: "top", whiteSpace: "break-all"}}>
                <span id={`tooltip-sg-${props.task?.task_arn}`}>
                    {showNetworkNames ? props.task?.task_security_group?.name : props.task?.task_security_group?.id}
                    &nbsp;<small><ExternalLink href={awsSecurityGroupLink(props.task?.task_security_group?.id)} /></small>
                </span>
            </td>
            <Tooltip id={`tooltip-sg-${props.task.task_arn}`} position="top" shape="squared" size="small"
                text={showNetworkNames ? props.task?.task_security_group?.id : props.task?.task_security_group?.name} />
        </tr>
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Subnets: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}>
                { props.task?.task_subnets?.map(subnet => <>
                    <span id={`tooltip-subnet-${props.task?.task_arn}-${subnet.id}`}>
                        {showNetworkNames ? subnet.name : subnet.id}
                        &nbsp;<small><ExternalLink href={awsSubnetLink(subnet.id)} /></small>
                    </span> <br />
                    <Tooltip id={`tooltip-subnet-${props.task?.task_arn}-${subnet.id}`} position="top" shape="squared" size="small"
                        text={showNetworkNames ? subnet.id : subnet.name} />
                </>) }
            </td>
        </tr>
    </tbody></table>
}

const TaskStatusLine = (props) => {
    const running = useTaskStatus(props.task);
    const onRefresh = (e) => {
        running.refresh();
        e.stopPropagation();
    }
    const [showRunningIds, setShowRunningIds] = useState(false);
    const onClickRunning = (e) => {
        setShowRunningIds(!showRunningIds);
        e.stopPropagation();
    }
    return <div onClick={(e) => e.stopPropagation()}>
        { running.loading ? <>
            <b>Task Status</b>:&nbsp;
            <span style={{position: "relative", top: "2px"}}>&nbsp;<PuffSpinnerInline size="18" /></span>
        </> : <span className="pointer" onClick={onRefresh}>
            <b>Task Status</b>:&nbsp;
            <>
                {running.data?.task_running ? <>
                    <span style={{color: "red"}} onClick={onClickRunning}><b>Running</b>&nbsp;{showRunningIds ? Char.DownArrow : Char.UpArrow}</span>
                </>:<>
                    <b style={{color: "black"}}>Idle</b>
                </> }
            </>
            { running.data?.task_last_ran_at && <>
                &nbsp;<b>|</b>&nbsp;<b>Approximate Last Run Time</b>: {DateTime.Format(running.data?.task_last_ran_at)}
            </> }
                &nbsp;<b>|</b>&nbsp;Refresh&nbsp;<b style={{position: "relative", top: "1px"}}>{Char.Refresh}</b>
        </span> }
        { showRunningIds && <small style={{ whiteSpace: "break-all"}}>
            <SeparatorH color="lightgray" top="3pt" bottom="3pt" />
            <b>Running Task Cluster</b>:&nbsp;&nbsp;{props.task.task_arn}&nbsp;<ExternalLink href={awsClusterLink(props.task.task_cluster.name)} /><br />
            <b>Running Task Definition</b>:&nbsp;&nbsp;{props.task.task_arn}&nbsp;<ExternalLink href={awsTaskLink(props.task.task_arn)} /><br />
            <b>Running Tasks</b>:
            { running.data?.task_running_ids?.map(id => <>
                &nbsp;&nbsp;{id}&nbsp;<ExternalLink href={awsTaskRunningLink(props.task?.task_cluster?.name, id)} />
            </> )}
        </small> }
    </div>
}

const Warnings = (props) => {
    return <span onClick={(e) => e.stopPropagation()}>
        <WarningMultipleTasks task={props.task} />
        <WarningNoCluster task={props.task} />
        <WarningNoVpc task={props.task} />
        <WarningNoSecurityGroup task={props.task} />
        <WarningNoSubnets task={props.task} />
    </span>
}

const WarningMultipleTasks = (props) => {
    return <>
        { props.task?.duplicate_tasks &&
            <div className="box bigmargin error"><small>
                <b>Warning</b>: Multiple task definitions found for this environment.
                <div style={{background: "darkred", height: "1px", marginTop: "4pt", marginBottom: "4pt"}} />
                <table style={{fontSize: "inherit", color: "inherit"}}><tbody>
                    <tr>
                        <td style={{paddingRight: "4pt"}}><b>{Char.RightArrow}</b></td>
                        <td><u><b>{props.task.task_arn}</b></u>&nbsp;<small><ExternalLink href={awsTaskLink(props.task.task_arn)} color={"inherit"} /></small></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td><small>Registered At: {DateTime.Format(props.task?.task_registered_at)}</small></td>
                    </tr>
                    { props.task?.duplicate_tasks?.map((task, index) => <>
                        <tr>
                            <td>{Char.RightArrow}</td>
                            <td>
                                <u>{task.task_arn}</u>&nbsp;<small><ExternalLink href={awsTaskLink(task.task_arn)} color={"darkred"} /></small>
                            </td>
                        </tr>
                        <tr>
                            <td></td>
                            <td>
                                <small>
                                    Registered At: {DateTime.Format(task?.task_registered_at)}
                                </small>
                            </td>
                        </tr>
                    </> )}
                </tbody></table>
            </small></div>
        }
    </>
}

const WarningNoCluster = (props) => {
    return <>
        { !props.task?.task_cluster &&
            <div className="box bigmargin error"><small>
                <b>Warning</b>: No cluster found.
            </small></div>
        }
    </>
}

const WarningNoVpc = (props) => {
    return <>
        { !props.task?.task_vpc &&
            <div className="box bigmargin error"><small>
                <b>Warning</b>: No VPC found.
            </small></div>
        }
    </>
}

const WarningNoSubnets = (props) => {
    return <>
        { !props.task?.task_subnets &&
            <div className="box bigmargin error"><small>
                <b>Warning</b>: No subnets found.
            </small></div>
        }
    </>
}

const WarningNoSecurityGroup = (props) => {
    return <>
        { !props.task?.task_security_group &&
            <div className="box bigmargin error"><small>
                <b>Warning</b>: No security group found.
            </small></div>
        }
    </>
}

const TasksRunning = (props) => {
    const tasks = useFetch(`//aws/ecs/tasks_running/${props.task.task_cluster.name}`);
    const sortedTasks = tasks.data?.sort((a, b) => {
        a = a.task_arn?.toLowerCase();
        b = b.task_arn?.toLowerCase();
        return (a < b) ? -1 : ((a > b) ? 1 : 0);
    });
    return <>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td colSpan="2">
                    <i>Tasks running in cluster</i>:
                    <small>
                        <b>&nbsp;{props.task.task_cluster.name}</b>
                        &nbsp;<ExternalLink href={awsClusterLink(props.task.task_cluster.name)} />
                    </small>
                </td>
            </tr>
            { tasks.loading ? <>
                <TSeparatorH color="gray" top="7pt" bottom="4pt" />
                <StandardSpinner label="Loading running tasks" />
            </>:<>
                { sortedTasks?.map((task, index) => <>
                    { index == 0 ?
                        <TSeparatorH color="gray" top="7pt" bottom="4pt" />
                    :
                        <TSeparatorH color="lightgray" />
                    }
                    <tr style={{fontSize: "small"}}>
                        <td style={{whiteSpace: "nowrap", width: "1%", paddingRight: "4pt"}}> <b>Task Definition</b>: </td>
                        <td> <u>{task.task_arn}</u> <ExternalLink href={awsTaskLink(task.task_arn)} /></td>
                    </tr>
                    <tr style={{fontSize: "small"}}>
                        <td style={{verticalAlign: "top", whiteSpace: "nowrap", width: "1%", paddingRight: "4pt"}}> Tasks Running: </td>
                        <td>
                            <table style={{fontSize: "inherit"}}><tbody>
                                { task?.tasks?.map((task, index) => <>
                                    <tr>
                                        <td style={{paddingRight: "4pt"}}>
                                            {task.id} <ExternalLink href={awsTaskRunningLink(task.id)} />
                                        </td>
                                        <td>
                                            | Started: {DateTime.Format(task.started_at)} {Char.RightArrow} {Duration.Ago(task.started_at, true, false)}
                                        </td>
                                    </tr>
                                </>)}
                            </tbody></table>
                        </td>
                    </tr>
                        {/*
                    <tr style={{fontSize: "small"}}>
                        <td style={{whiteSpace: "nowrap", width: "1%", paddingRight: "4pt"}}> Task Running ID: </td>
                        <td> {task.task_running_id} <ExternalLink href={awsTaskRunningLink(props.task.task_cluster.name, task.task_running_id)} /></td>
                    </tr>
                    <tr style={{fontSize: "small"}}>
                        <td style={{whiteSpace: "nowrap", width: "1%", paddingRight: "4pt"}}> Task Started At: </td>
                        <td> {DateTime.Format(task.started_at)} <b>{Char.RightArrow}</b> {Duration.Ago(task.started_at, true, false)} </td>
                    </tr>
                    */}
                </> )}
            </> }
        </tbody></table>
    </>
}

export default PortalReindexPage;
