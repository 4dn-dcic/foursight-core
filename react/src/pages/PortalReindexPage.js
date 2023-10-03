import useHeader from '../hooks/Header';
import { useState } from 'react';
import Char from '../utils/Char'; 
import { ExternalLink } from '../Components'; 
import React from 'react';
import { StandardSpinner } from '../Spinners';
import Tooltip from '../components/Tooltip';
import useFetch from '../hooks/Fetch';

function awsTaskLink(arn) {
    const region = "us-east-1";
    return `https://${region}.console.aws.amazon.com/ecs/v2/task-definitions/${arn}/run-task`;
    return `https://${region}.console.aws.amazon.com/ecs/v2/task-definitions/${arn}?status=ACTIVE&region=${region}/run-task`;
}

const PortalReindexPage = (props) => {
    const tasks = useFetch("//aws/ecs/tasks/parsed");
    const deployTasks = () => tasks?.data?.filter(task => task.task_name == "Deploy");
    return <>
        <div className="container">
            <b style={{fontSize: "x-large"}}>Portal Reindex</b>
            { tasks.loading ?
                <PortalReindexContentLoading />
            : <>
                <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
                    Select the Portal environment below to reindex.
                </div>
                <PortalReindexContent tasks={deployTasks()} />
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
    const selectTask = (task) => isSelectedTask(task) ? setSelectedTask(null) : setSelectedTask(task);
    const isSelectedTask = (task) => selectedTask == task;

    const sortedTasks = props.tasks?.sort((a, b) => {
        a = a.task_env?.name?.toLowerCase();
        b = b.task_env?.name?.toLowerCase();
        return (a < b) ? -1 : ((a > b) ? 1 : 0);
    });

    return <div className="box" style={{paddingTop: "12pt"}}>
        { sortedTasks.map(task =>
            <PortalReindexBox task={task} selectedTask={selectedTask} selectTask={selectTask} isSelectedTask={isSelectedTask} />
        )}
    </div>
}

const PortalReindexBox = (props) => {

    const [showEnvs, setShowEnvs] = useState(false);
    const toggleEnv = (e) => { setShowEnvs(!showEnvs); e.stopPropagation(); e.preventDefault(); }

    return <div onClick={() => props.selectTask(props.task?.task_arn)} style={{marginTop:"4pt"}} className="hover-lighten">
        <table style={{width: "100%"}}><tbody><tr><td style={{verticalAlign: "top", paddingRight:"10pt", width: "1%"}}>
            <input
                name="radio"
                type="radio"
                value={props.task?.task_arn}
                checked={props.selectedTask == props.task?.task_arn}
                onChange={() => props.selectTask(props.task?.task_arn)}
                style={{marginTop:"10pt"}} />
        </td><td style={{verticalAlign: "top"}}>
            <div className="box bigmarginbottom lighten" style={{cursor:"default"}}>
                <u><b onClick={() => props.selectTask(props.task?.task_arn)} style={{color: "black"}}>{props.task?.task_env?.name}</b></u>
                <small onClick={toggleEnv} className="pointer" style={{marginLeft:"4pt"}}>{showEnvs ? Char.DownArrow : Char.UpArrow}</small>
                <small style={{float: "right"}}>
                    &nbsp;&nbsp;<ExternalLink href={props.task.task_env.portal_url} />
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
                { showEnvs && <PortalReindexEnvBox env={props.task?.task_env} task={props.task} /> }
                <small id={`tooltip-${props.task.task_arn}`}> { props.task?.task_arn } &nbsp;<ExternalLink href={awsTaskLink(props.task?.task_arn)} /> </small>
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
    const header = useHeader();
    const uniqueEnvNames = () => {
        const env = {};
        ["name", "full_name", "short_name", "public_name", "foursight_name"].forEach(name => {
             env[name] = props.env[name];
        });
        return Array.from(new Set(Object.values(env)))?.sort();
    }
    const vseparator = <><td style={{width: "10pt"}}></td><td style={{verticalAlign: "top", width: "1px", background: "black"}}></td><td style={{width: "10pt"}}></td></>
    return <div className="box bigmargin marginbottom"><small>
        <table style={{fontSize: "inherit"}}><tbody><tr><td style={{verticalAlign: "top"}}>
            <table style={{fontSize: "inherit"}}><tbody>
                <tr>
                    <td colspan="2">
                        AWS Account
                    </td>
                </tr>
                <tr><td colspan="2" style={{background: "gray", height: "1px"}}></td></tr>
                <tr>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Account Number: </td>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> {header.app?.credentials?.aws_account_number} </td>
                </tr>
                <tr>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Account Name: </td>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> {header.app?.credentials?.aws_account_name} </td>
                </tr>
            </tbody></table>
        </td>
        {vseparator}
        <td style={{verticalAlign: "top"}}>
            <table style={{fontSize: "inherit"}}><tbody>
                <tr>
                    <td colspan="2">
                        AWS Networking
                    </td>
                </tr>
                <tr><td colspan="2" style={{background: "gray", height: "1px"}}></td></tr>
                <tr>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> VPC: </td>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}><span id={`tooltip-vpc-${props.task?.task_arn}`}>{props.task?.task_vpc?.id}</span> </td>
                    <Tooltip id={`tooltip-vpc-${props.task.task_arn}`} position="top" shape="squared" size="small" text={props.task?.task_vpc?.name} />
                </tr>
                <tr>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Security Group: </td>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> <span id={`tooltip-sg-${props.task?.task_arn}`}>{props.task?.task_security_group?.id}</span> </td>
                    <Tooltip id={`tooltip-sg-${props.task.task_arn}`} position="top" shape="squared" size="small" text={props.task?.task_security_group?.name} />
                </tr>
                <tr>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Subnets: </td>
                    <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}>
                        { props.task?.task_subnets?.map(subnet => <>
                            <span id={`tooltip-${subnet.id}`}>{subnet.id}</span> <br />
                            <Tooltip id={`tooltip-${subnet.id}`} position="top" shape="squared" size="small" text={subnet.name} />
                        </>) }
                    </td>
                </tr>
            </tbody></table>
        </td>
        {vseparator}
        <td style={{verticalAlign: "top"}}>
            <u>Environment Aliases</u> <br />
            {uniqueEnvNames().map((env, index) => <>
                {index > 0 && <br />} {env}
            </> )}
        </td></tr></tbody></table>
    </small></div>
}

export default PortalReindexPage;
