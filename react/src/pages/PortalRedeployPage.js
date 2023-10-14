import React from 'react';
import { useEffect, useRef, useState } from 'react';
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
import Yaml from '../utils/Yaml';

const region = "us-east-1";

function awsClusterRunLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/task-definitions/${id}/run-task`;
}

function awsClusterLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${id}/services?region=${region}`;
}

const PortalRedeployPage = (props) => {

    const [args, setArgs] = useSearchParams();

    const clusters = useFetch("//aws/ecs/clusters_for_update", {
        onData: (data) => {
            setShowDetails(data.reduce((result, cluster) => {
                result[cluster.cluster_arn] = false;
                return result;
            }, {}));
            return data;
        }
    });

    // The top-level up/down arrow toggle can be used to expand/collapse cluster ("env") details;
    // if ANY of the cluster details are expanded, then the top-level toggle collapses all of them;
    // if NONE of the cluster details are expanded, then the top-level toggle expands all of them.

    const [showDetails, setShowDetails] = useState({});
    const isShowDetails = () => { for (const key of Object.keys(showDetails)) if (showDetails[key]) return true; return false; }
    const toggleShowDetails = () => {
        const showDetail = isShowDetails();
        for (const key of Object.keys(showDetails)) showDetails[key] = !showDetail;
        setShowDetails({...showDetails});
    }
    const toggleShowDetail = (cluster) => { showDetails[cluster.cluster_arn] = !showDetails[cluster.cluster_arn]; setShowDetails({...showDetails}); }
    const setShowDetail = (cluster) => { showDetails[cluster.cluster_arn] = true; setShowDetails({...showDetails}); }
    const isShowDetail = (cluster) => showDetails[cluster.cluster_arn];

    return <>
        <div className="container">
            <div>
                <b style={{fontSize: "x-large"}}>Portal Redeploy</b>
            </div>
            { clusters.loading ?
                <ContentLoading />
            : <>
                <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
                    <i>Select the Portal environment below to redeploy</i>.
                    <span style={{float: "right"}} className="pointer" onClick={toggleShowDetails} id="tooltip-show-envs">
                        { isShowDetails() ? <b>{Char.DownArrow}</b> : <b>{Char.UpArrow}</b> }
                        <Tooltip id="tooltip-show-envs" position="top" size="small"
                            text={`Click to ${isShowDetails() ? "hide" : "show"} details for task runs.`} />
                    </span>
                </div>
                <Content
                    clusters={clusters.data}
                    isShowDetail={isShowDetail}
                    toggleShowDetail={toggleShowDetail}
                    setShowDetail={setShowDetail} />
            </> }
        </div>
    </>
}

const ContentLoading = (props) => {
    return <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
        <StandardSpinner />
    </div>
}

const Content = (props) => {

    const [selectedCluster, setSelectedCluster] = useState();
    const selectCluster = (cluster) => { isSelectedCluster(cluster) ? setSelectedCluster(null) : setSelectedCluster(cluster.cluster_arn); }
    const isSelectedCluster = (cluster) => selectedCluster == cluster.cluster_arn;
    const unselectCluster = () => setSelectedCluster(null);

    const sortedClusters = props.clusters?.sort((a, b) => {
        a = a.env?.name?.toLowerCase();
        b = b.env?.name?.toLowerCase();
        return (a < b) ? -1 : ((a > b) ? 1 : 0);
    });

    return <div className="box" style={{paddingTop: "12pt"}}>
        { sortedClusters?.map(cluster =>
            <PortalReindexBox
                cluster={cluster}
                selectedCluster={selectedCluster}
                selectCluster={selectCluster}
                unselectCluster={unselectCluster}
                isSelectedCluster={isSelectedCluster}
                isShowDetail={props.isShowDetail}
                toggleShowDetail={props.toggleShowDetail}
                setShowDetail={props.setShowDetail} />
        )}
    </div>
}

const PortalReindexBox = (props) => {

    const showDetailOnSelect = false;
    const [ showDetail, setShowDetail ] = useState(false);
    const isShowDetail = () => props.isShowDetail(props.cluster);
    const toggleShowDetail = (e) => {
        props.toggleShowDetail(props.cluster);
        e.stopPropagation(); e.preventDefault();
    }
    const isSelectedCluster = () => props.isSelectedCluster(props.cluster);
    const selectCluster = () =>  {
        props.selectCluster(props.cluster);
        if (showDetailOnSelect) props.setShowDetail(props.cluster);
    }

    return <div xonClick={selectCluster} style={{marginTop:"4pt"}} className="hover-lighten">
        <table style={{width: "100%"}}><tbody><tr>
        <td style={{verticalAlign: "top", paddingRight:"10pt", width: "1%"}} onClick={selectCluster}>
            <input
                name="radio"
                type="radio"
                value={props.cluster?.cluster_arn}
                checked={isSelectedCluster()}
                onChange={selectCluster}
                style={{marginTop:"10pt"}}
                id={`tooltip-run-${props.cluster?.cluster_arn}`} />
                <Tooltip id={`tooltip-run-${props.cluster?.cluster_arn}`} position="left" shape="squared" bold={true} size="small" text={"Click to run ..."} />
        </td>
        <td style={{verticalAlign: "top"}} onClick={selectCluster}>
            <div className="box bigmarginbottom lighten" style={{cursor:"default"}}>
                <span id={`tooltip-show-env-${props.cluster?.cluster_arn}`} className="pointer" onClick={toggleShowDetail}>
                    <b style={{color: "black", textDecoration: "underline"}}>{props.cluster?.env?.name}</b>
                    <small style={{marginLeft:"4pt"}}>
                        {isShowDetail() ? <b>{Char.DownArrow}</b> : <b>{Char.UpArrow}</b>}
                    </small>
                </span>
                <Tooltip id={`tooltip-show-env-${props.cluster?.cluster_arn}`} position="top" size="small"
                    text={`Click to ${isShowDetail() ? "hide" : "show"} details for cluster run.`} />
                <small style={{float: "right"}}>
                    &nbsp;&nbsp;<ExternalLink href={props.cluster.env?.portal_url} />
                </small>
                { (props.cluster?.env?.is_production || props.cluster?.env?.is_staging || props.cluster?.env?.color) &&
                    <small style={{float: "right", color: props.cluster?.env?.color == "blue" ? "blue" : (props.cluster?.env?.color == "green" ? "green" : "")}}>
                        {props.cluster?.env?.is_production && <b>PRODUCTION</b>}
                        {props.cluster?.env?.is_staging && <b>STAGING</b>}
                        {props.cluster?.env?.color && <>
                            &nbsp;({props.cluster?.env?.color?.toUpperCase()})
                        </>}
                    </small>
                }
                <br />
                <small id={`tooltip-${props.cluster.cluster_arn}`}> {props.cluster?.cluster_arn}&nbsp;<ExternalLink href={awsClusterRunLink(props.cluster?.cluster_arn)} /></small>
                { isSelectedCluster() &&
                    <ReindexButtonsBox cluster={props.cluster}
                        unselectCluster={props.unselectCluster}
                        isShowDetail={isShowDetail}
                        toggleShowDetail={toggleShowDetail} />
                }
                { isShowDetail() && <DetailBox env={props.cluster?.env} cluster={props.cluster} /> }
                <Tooltip id={`tooltip-${props.cluster.cluster_arn}`} position="right" shape="squared" size="small" text={"ARN of the AWS cluster definition to be updated."} />
            </div>
        </td></tr></tbody></table>
    </div>
}

const ReindexButtonsBox = (props) => {
    const onClickIgnore = (e) => { e.stopPropagation(); e.preventDefault(); }
    return <>
        <div className="box" style={{background: "inherit", marginTop: "4pt", paddingTop: "8pt"}} onClick={onClickIgnore}>
            <ReindexButtons
                cluster={props.cluster}
                unselectCluster={props.unselectCluster}
                isShowDetail={props.isShowDetail}
                toggleShowDetail={props.toggleShowDetail} />
        </div>
    </>
}

const ReindexButtonsBoxDisabled = (props) => {
    return <>
        <div className="box bigmargin" style={{background: "inherit", marginTop: "6pt", paddingTop: "8pt", color: "red"}}>
            <b>Redeploy disabled due to errors.</b>
        </div>
    </>
}

const ReindexButtonsClusterStatusLoading = (props) => {
    return <>
        <table><tbody><tr><td>
            <ReindexButton cluster={props.cluster} disabled={true} />
        </td><td style={{paddingLeft: "8pt"}}>
            <StandardSpinner label="Fetching cluster status" />
        </td></tr></tbody></table>
    </>
}

const ReindexButtons = (props) => {
    const [confirmed, setConfirmed] = useState(false);
    const [running, setRunning] = useState(false);
    const [runDone, setRunDone] = useState(false);
    const [runResult, setRunResult] = useState(false);
    const fetch = useFetchFunction();
    const onClickCancel = (e) => { setConfirmed(false); e.stopPropagation(); }
    const onClickReindex = (e) => {
        if (confirmed) {
            setRunning(true);
            const url = `//aws/ecs/task_run/${props.task.cluster_arn}/${props.task.task_definition_arn}`;
            const payload = {
                subnets: props.task.subnets,
                security_group: props.task.security_group
            }
            fetch(url, { method: "POST", payload: payload, onDone: (result) => {
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
    const toggleShowDetail = (e) => props.toggleShowDetail(e);
    return <>
        { confirmed ? <>
            { running ? <div style={{marginTop: "-2pt"}}>
                <StandardSpinner label="Kicking off task"/>
            </div>:<>
                { runDone ? <>
                    <RunResult task={props.task}
                        running={props.running}
                        runDone={runDone}
                        runResult={runResult}
                        setConfirmed={setConfirmed}
                        setRunDone={setRunDone}
                        unselectCluster={props.unselectCluster} />
                </>:<>
                    <ReindexButtonConfirmed task={props.task} onClickReindex={onClickReindex} onClickCancel={onClickCancel} running={props.running} />
                </> }
            </> }
        </>: <>
            <ReindexButton task={props.task} onClickReindex={onClickReindex} />
        </> }
    </>
}

const RunResult = (props) => {
    const [showJson, setShowJson] = useState(false);
    const toggleShowJson = () => setShowJson(!showJson);
    const onClickRunDoneX = (e) => {
        props.setRunDone(false);
        props.setConfirmed(false);
        props.unselectCluster();
    }
    const widthRef = useRef(null);
    return <div ref={widthRef}>
        <div className="pointer" onClick={onClickRunDoneX} style={{float: "right", marginRight: "2pt"}}><b>{Char.X}</b></div>
        <div className="pointer" onClick={toggleShowJson}>
            { props.runResult.data?.error ? <span style={{color: "red"}}>
                <b>Error kicking off task ...</b>
                <SeparatorH color="red" />
                {props.runResult.data.error}
            </span>:<>
                <b>Kicked off {props.task.type === "deploy" ? <>reindex</> : <>task</>} {Char.RightArrow}</b> <small><u>{props.runResult?.data?.task_running_id}</u></small>&nbsp;
                <small><ExternalLink href={awsClusterLink(props.task.cluster_arn, props.runResult?.data?.task_running_id)} /></small>
            </> }
            { showJson && <>
                <SeparatorH />
                <pre style={{background: "inherit", color: props.runResult.data?.error ? "red" : "inherit", wordWrap:"break-word", maxWidth: widthRef?.current?.offsetWidth}}>
        
                    {Yaml.Format(props.runResult.data)}
                </pre>
            </> }
        </div>
    </div>
}

const ReindexButtonConfirmed = (props) => {
    return <table><tbody><tr>
        <td style={{verticalAlign: "top"}}>
            <CancelButton onClickCancel={props.onClickCancel} />
        </td><td style={{verticalAlign: "top", paddingLeft: "8pt"}}>
            <ReindexButton task={props.task} onClickReindex={props.onClickReindex} confirmed={true} />
        </td><td style={{verticalAlign: "top", paddingLeft: "0pt"}}>
            <b style={{position: "relative", bottom: "-3pt", whiteSpace: "nowrap"}}>&nbsp;&nbsp;&nbsp;{Char.LeftArrow}&nbsp;
            { props.task.type == "deploy" ? <>
                Are you sure you want to reindex <u>{props.task.env.name}</u>?
            </>:<>
                Are you sure you want to run this task for <u>{props.task.env.name}</u>?
            </> }
            </b>
        </td>
    </tr></tbody></table>
}

const ReindexButton = (props) => {
    return <div className={`check-run-button ${props.disabled && "disabled"}`} style={{width: "fit-content", border: "1px solid inherit"}} onClick={props?.onClickReindex}>
        { props.confirmed && <>&nbsp;Yes:</> }&nbsp;{ props.task?.type == "deploy" ? <>Reindex</> : <>Run Cluster</> }&nbsp;
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

const DetailBox = (props) => {
    const header = useHeader();
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
                    <NetworkDetails task={props.cluster} />
                </td>
            </tr>
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
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> {props.task?.env?.full_name} </td>
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
            <span onClick={toggleShowNetworkNames} className="pointer" id={`tooltip-network-${props.task.task_definition_arn}`} >
                &nbsp;{showNetworkNames ? <b>{Char.Diamond}</b> : <b>{Char.Trigram}</b>}
                <Tooltip id={`tooltip-network-${props.task.task_definition_arn}`} position="top" size="small" text={`Click to view ${showNetworkNames ? "IDs" : "names"}.`}/>
            </span>
        </td></tr>
        <TSeparatorH double={true} />
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}>
                Cluster
            </td>
            <td style={{verticalAlign: "top", whiteSpace: "break-all"}}>
                <span>
                    {props.task?.cluster_arn}
                    &nbsp;<small><ExternalLink href={awsClusterLink(props.task?.cluster_arn)} /></small>
                </span>
            </td>
        </tr>
    </tbody></table>
}

export default PortalRedeployPage;
