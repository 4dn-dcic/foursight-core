import useHeader from '../hooks/Header';
import { useEffect, useState } from 'react';
import Char from '../utils/Char'; 
import DateTime from '../utils/DateTime';
import { ExternalLink } from '../Components'; 
import React from 'react';
import { StandardSpinner } from '../Spinners';
import Tooltip from '../components/Tooltip';
import useFetch from '../hooks/Fetch';

const region = "us-east-1";

function awsTaskRunLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/task-definitions/${id}/run-task`;
}

function awsTaskLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/task-definitions/${id}`;
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

const PortalReindexPage = (props) => {

    const tasks = useFetch("//aws/ecs/tasks/run?task=deploy", {
        onData: (data) => {
            setShowEnvs(data.reduce((result, task) => {
                result[task.task_arn] = false;
                return result;
            }, {}));
            return data;
        }
    });

    // The top-level up/down arrow toggle can be used to expand/collapse task ("env") details;
    // if ANY of the task details are expanded, then the top-level toggle collapses all of them;
    // if NONE of the task details are expanded, then the top-level toggle expands all of them.

    const [showEnvs, setShowEnvs] = useState({});
    const isShowEnvs = () => { for (const key of Object.keys(showEnvs)) if (showEnvs[key]) return true; return false; }
    const toggleShowEnvs = () => {
        const showEnv = isShowEnvs();
        for (const key of Object.keys(showEnvs)) showEnvs[key] = !showEnv;
        setShowEnvs({...showEnvs});
    }
    const toggleShowEnv = (task) => { showEnvs[task.task_arn] = !showEnvs[task.task_arn]; setShowEnvs({...showEnvs}); }
    const setShowEnv = (task) => { showEnvs[task.task_arn] = true; setShowEnvs({...showEnvs}); }
    const isShowEnv = (task) => showEnvs[task.task_arn];

    return <>
        <div className="container">
            <b style={{fontSize: "x-large"}}>Portal Reindex</b>
            { tasks.loading ?
                <PortalReindexContentLoading />
            : <>
                <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
                    Select the Portal environment below to reindex.
                    <span style={{float: "right"}} className="pointer" onClick={toggleShowEnvs} id="tooltip-show-envs">
                        { isShowEnvs() ? <b>{Char.DownArrow}</b> : <b>{Char.UpArrow}</b> }
                        <Tooltip id="tooltip-show-envs" position="top" size="small"
                            text={`Click to ${isShowEnvs() ? "hide" : "show"} details for task run.`} />
                    </span>
                </div>
                <PortalReindexContent
                    tasks={tasks.data}
                    isShowEnv={isShowEnv}
                    toggleShowEnv={toggleShowEnv}
                    setShowEnv={setShowEnv} />
            </> }
        </div>
    </>
}

const PortalReindexContentLoading = (props) => {
    return <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
        <StandardSpinner />
    </div>
}

const PortalReindexContent = (props) => {

    const [selectedTask, setSelectedTask] = useState();
    const selectTask = (task) => { isSelectedTask(task) ? setSelectedTask(null) : setSelectedTask(task.task_arn); }
    const isSelectedTask = (task) => selectedTask == task.task_arn;

    const sortedTasks = props.tasks?.sort((a, b) => {
        a = a.task_env?.name?.toLowerCase();
        b = b.task_env?.name?.toLowerCase();
        return (a < b) ? -1 : ((a > b) ? 1 : 0);
    });

    return <div className="box" style={{paddingTop: "12pt"}}>
        { sortedTasks.map(task =>
            <PortalReindexBox
                task={task}
                selectedTask={selectedTask}
                selectTask={selectTask}
                isSelectedTask={isSelectedTask}
                isShowEnv={props.isShowEnv}
                toggleShowEnv={props.toggleShowEnv}
                setShowEnv={props.setShowEnv} />
        )}
    </div>
}

const PortalReindexBox = (props) => {

    const showEnvOnSelect = false;
    const [ showEnv, setShowEnv ] = useState(false);
    const isShowEnv = () => {
        return props.isShowEnv(props.task);
    }
    const toggleShowEnv = (e) => {
        props.toggleShowEnv(props.task);
        e.stopPropagation(); e.preventDefault();
    }
    const selectTask = () =>  {
        props.selectTask(props.task);
        if (showEnvOnSelect) props.setShowEnv(props.task);
    }
    const isSelectedTask = () =>  {
        return props.isSelectTask(props.task);
    }

    return <div onClick={selectTask} style={{marginTop:"4pt"}} className="hover-lighten">
        <table style={{width: "100%"}}><tbody><tr><td style={{verticalAlign: "top", paddingRight:"10pt", width: "1%"}}>
            <input
                name="radio"
                type="radio"
                value={props.task?.task_arn}
                checked={props.selectedTask == props.task?.task_arn}
                onChange={selectTask}
                style={{marginTop:"10pt"}} />
        </td><td style={{verticalAlign: "top"}}>
            <div className="box bigmarginbottom lighten" style={{cursor:"default"}}>
                <b onClick={selectTask} className="pointer" style={{color: "black", textDecoration: isShowEnv() ? "" : "underline"}}>{props.task?.task_env?.name}</b>
                <small onClick={toggleShowEnv} className="pointer" style={{marginLeft:"4pt"}} id={`tooltip-show-env-${props.task?.task_arn}`}>
                    {isShowEnv() ? <b>{Char.DownArrow}</b> : <b>{Char.UpArrow}</b>}
                </small>
                <Tooltip id={`tooltip-show-env-${props.task?.task_arn}`} position="top" size="small"
                    text={`Click to ${isShowEnv() ? "hide" : "show"} details for task run.`} />
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
                { isShowEnv() && <PortalReindexEnvBox env={props.task?.task_env} task={props.task} /> }
                <small id={`tooltip-${props.task.task_arn}`}> { props.task?.task_arn }&nbsp;<ExternalLink href={awsTaskRunLink(props.task?.task_arn)} /> </small>
                <PortalReindexWarnings task={props.task} />
                <Tooltip id={`tooltip-${props.task.task_arn}`} position="right" shape="squared" size="small" text={"ARN of the AWS task definition to be run for the reindex."} />
                { props.selectedTask === props.task?.task_arn && <PortalReindexButtons task={props.task} /> }
            </div>
        </td></tr></tbody></table>
    </div>
}

const PortalReindexButtons = (props) => {

    const [reindex, setReindex] = useState(false);
    const onClickReindex = (e) => { setReindex(true); e.stopPropagation(); e.preventDefault(); }
    const onClickCancel = (e) => { setReindex(false); e.stopPropagation(); e.preventDefault(); }
    const onClickIgnore = (e) => { e.stopPropagation(); e.preventDefault(); }

    return <>
        <div className="box bigmargin" style={{background: "inherit", marginTop: "6pt", paddingTop: "8pt"}} onClick={onClickIgnore}>
            { !reindex ?
                <div>
                    <div className="check-run-button" style={{width: "fit-content"}} onClick={onClickReindex}>
                        &nbsp;Reindex&nbsp;
                    </div>
                </div>
            :
                <div>
                    <table><tbody><tr><td valign="top">
                        <div className="check-action-confirm-button" style={{width: "fit-content", marginBottom: "-1pt"}} onClick={onClickCancel}>
                            &nbsp;<b>Cancel</b>&nbsp;
                        </div>
                    </td><td valign="top">
                        <div className="check-run-button" style={{width: "fit-content", border: "1px solid inherit", marginLeft:"8pt"}} onClick={onClickReindex}>
                            &nbsp;Yes: Reindex&nbsp;
                        </div>
                    </td><td valign="top">
                        <b style={{position: "relative", bottom: "-3pt"}}>&nbsp;&nbsp;&nbsp;{Char.LeftArrow} Are you sure you want to reindex <u>{props.task.task_env.name}</u>?</b>
                    </td></tr></tbody></table>
                </div>
            }
        </div>
    </>
}

const PortalReindexEnvBox = (props) => {
    const [showNetworkNames, setShowNetworkNames] = useState(false);
    const toggleShowNetworkNames = (e) => { setShowNetworkNames(!showNetworkNames); e.stopPropagation() }
    const header = useHeader();
    const uniqueEnvNames = () => {
        const env = {};
        ["name", "full_name", "short_name", "public_name", "foursight_name"].forEach(name => {
             env[name] = props.env[name];
        });
        return Array.from(new Set(Object.values(env)))?.sort();
    }
    const vseparator = <><td style={{width: "8pt"}}></td><td style={{verticalAlign: "top", width: "1px", background: "black"}}></td><td style={{width: "8pt"}}></td></>
    const hseparator = <><tr><td colSpan="2" style={{height: "1pt"}}></td></tr><tr><td colSpan="2" style={{background: "gray", height: "1px"}}></td></tr><tr><td colSpan="2" style={{height: "1pt"}}></td></tr><tr><td colSpan="2" style={{background: "gray", height: "1px"}}></td></tr><tr><td colSpan="2" style={{height: "1pt"}}></td></tr></>
    return <div className="box bigmargin marginbottom"><small>
        <table style={{fontSize: "inherit"}}><tbody><tr><td style={{verticalAlign: "top"}}>
            <table style={{fontSize: "inherit"}}><tbody>
                <tr><td colSpan="2"> AWS Account </td></tr>
                {hseparator}
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
        </td>
        {vseparator}
        <td style={{verticalAlign: "top"}}>
            <table style={{fontSize: "inherit"}}><tbody>
                <tr><td colSpan="2" style={{whiteSpace: "nowrap"}}> Environment Aliases </td></tr>
                {hseparator}
                <tr>
                    <td colSpan="2" style={{whiteSpace: "nowrap"}}>
                        {uniqueEnvNames().map((env, index) => <>
                            {index > 0 && <br />} {env}
                        </> )}
                    </td>
                </tr>
            </tbody></table>
        </td>
        {vseparator}
        <td style={{verticalAlign: "top"}}>
            <table style={{fontSize: "inherit"}}><tbody>
                <tr><td /><td width="800pt"/></tr> {/* dummy to make it expand to right */}
                <tr><td colSpan="2"> AWS Network
                    <span onClick={toggleShowNetworkNames} className="pointer" id={`tooltip-network-${props.task.task_arn}`} >
                        &nbsp;{showNetworkNames ? <b>{Char.Diamond}</b> : <b>{Char.Trigram}</b>}
                        <Tooltip id={`tooltip-network-${props.task.task_arn}`} position="top" size="small" text={`Click to view ${showNetworkNames ? "IDs" : "names"}.`}/>
                    </span>
                </td></tr>
                {hseparator}
                <tr>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Cluster: </td>
                    <td style={{verticalAlign: "top", whiteSpace: "break-all"}}>
                        <span id={`tooltip-cluster-${props.task?.task_arn}`}>
                            {showNetworkNames ? props.task?.task_cluster?.name : props.task?.task_cluster?.name}
                            &nbsp;<small><ExternalLink href={awsClusterLink(props.task?.task_cluster?.name)} /></small>
                        </span>
                    </td>
                    <Tooltip id={`tooltip-cluster-${props.task.task_arn}`} position="top" shape="squared" size="small"
                        text={showNetworkNames ? props.task?.task_cluster?.name : props.task?.task_cluster?.name} />
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
        </td>
        </tr></tbody></table>
    </small></div>
}

const PortalReindexWarnings = (props) => {
    return <>
        <WarningMultipleTasks task={props.task} />
        <WarningNoVpc task={props.task} />
        <WarningNoSecurityGroup task={props.task} />
        <WarningNoSubnets task={props.task} />
    </>
}

const WarningMultipleTasks = (props) => {
    return <>
        { props.task?.duplicate_tasks &&
            <div className="box bigmargin error"><small>
                <b>Warning</b>: Multiple task definitions found for this environment.
                <div style={{background: "darkred", height:"1px", marginTop: "4pt", marginBottom: "4pt"}} />
                <table style={{fontSize: "inherit", color: "inherit"}}><tbody>
                    <tr>
                        <td style={{paddingRight: "4pt"}}><b>{Char.RightArrow}</b></td>
                        <td><u><b>{props.task.task_arn}</b></u>&nbsp;<small><ExternalLink href={awsTaskLink(props.task.task_arn)} color={"inherit"} /></small></td>
                    </tr>
                    <tr>
                        <td></td>
                        <td><small>Registered At: {DateTime.Format(props.task?.task_registered_at)}</small></td>
                    </tr>
                    { props.task?.duplicate_tasks.map((task, index) => <>
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

const WarningNoVpc = (props) => {
    return <>
        { !props.task?.task_vpc &&
            <div className="box bigmargin error"><small>
                <b>Warning</b>: No VPC found.
            </small></div>
        }
    </>
}

export default PortalReindexPage;
