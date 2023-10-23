import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Char from '../utils/Char'; 
import DateTime from '../utils/DateTime';
import Duration from '../utils/Duration';
import { ExternalLink } from '../Components'; 
import Image from '../utils/Image';
import { PuffSpinnerInline, StandardSpinner } from '../Spinners';
import Str from '../utils/Str';
import Time from '../utils/Time';
import { ToggleShowDetailArrow } from '../Components';
import Tooltip from '../components/Tooltip';
import Type from '../utils/Type';
import useFetch from '../hooks/Fetch';
import useFetchFunction from '../hooks/FetchFunction';
import useHeader from '../hooks/Header';
import Yaml from '../utils/Yaml';

const region = "us-east-1";

function awsClusterLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${id}/services?region=${region}`;
}

function awsServiceLink(cluster_arn, service_arn) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${cluster_arn}/services/${service_arn}/health?${region}`;
}

function awsTaskDefinitionLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/task-definitions/${id}`;
}

function awsCodebuildLogLink(account_number, project, logGroup, logStream) {
    return `https://${region}.console.aws.amazon.com/codesuite/codebuild/${account_number}/projects/${project}/build/${project}:${logStream}/?region=${region}`;
}

function awsCodebuildProjectLink(account_number, project) {
    return `https://${region}.console.aws.amazon.com/codesuite/codebuild/${account_number}/projects/${project}/history`;
}

function awsImageRepoLink(account_number, project) {
    return `https://${region}.console.aws.amazon.com/ecr/repositories/private/${account_number}/${project}`
}

function awsImageTagLink(account_number, repo, sha) {
    return `https://${region}.console.aws.amazon.com/ecr/repositories/private/${account_number}/${repo}/_/image/${sha}/details`
}

const useFetchClusters = (onData) => {
    return useFetch("//aws/ecs/clusters_for_update", { onData: (data) => { if (onData) onData(data); return data; } });
}

const useFetchServices = (clusterArn) => {
    //return useFetch(`//aws/ecs/services_for_update/${clusterArn}`, { cache: true });
    return useFetch(`//aws/ecs/services_for_update/${clusterArn}?include_image=false&include_build=false`, { cache: true });
}

const useFetchStatus = (clusterArn) => {
    return useFetch(`//aws/ecs/cluster_status/${clusterArn}`, { cache: true });
}

const useFetchBuildInfo = (imageArn) => {
    return useFetch(imageArn ? `//aws/ecr/build/${encodeURIComponent(imageArn)}` : null, { cache: true });
}

const useFetchBuildDigest = (build, args) => {
    const logGroup = build?.log_group;
    const logStream = build?.log_stream;
    const imageTag = build?.image_tag;
    return useFetch(imageTag ? `//aws/codebuild/digest/${encodeURIComponent(logGroup)}/${logStream}?image_tag=${imageTag}` : null, args);
}

const useFetchImageInfo = (imageArn) => {
    return useFetch(imageArn ? `//aws/ecr/image/${encodeURIComponent(imageArn)}` : null, { cache: true });
}

const useFetchPortalHealth = () => {
    return useFetch("/portal_health");
}

const PortalRedeployPage = (props) => {

    const [args, setArgs] = useSearchParams();

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

    const clusters = useFetchClusters((data) => {
        setShowDetails(data.reduce((result, cluster) => {
            result[cluster.cluster_arn] = false;
            return result;
        }, {}));
    });

    return <>
        <div className="container">
            <div>
                <b style={{fontSize: "x-large"}}>Portal Redeploy</b>
            </div>
            { clusters.loading ?
                <ContentLoading />
            : <>
                <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
                    <i>Select the Portal environment (cluster) below to redeploy</i>.
                    <ToggleShowDetailArrow isShow={isShowDetails} toggleShow={toggleShowDetails} float="right" />
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
            <PortalRedeployBox
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

const PortalRedeployBox = (props) => {

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
    const [deployedBranch, setDeployedBranch] = useState();
    const [deployingBranch, setDeployingBranch] = useState();

    const services = useFetchServices(props.cluster?.cluster_arn);
    const status = useFetchStatus(props.cluster?.cluster_arn);

    const setDeployedBranchFromServicesAndStatus = () => {
        if (status.data?.started_at) {
            if (services.data?.build?.latest?.finished_at < status.data?.started_at) {
                setDeployedBranch(services.data?.build?.latest?.branch);
            }
            else if (services.data?.build?.previous?.finished_at < status.data?.started_at) {
                setDeployedBranch(services.data?.build?.previous?.branch);
            }
            else if (services.data?.build?.next_previous?.finished_at < status.data?.started_at) {
                setDeployedBranch(services.data?.build?.next_previous?.branch);
            }
        }
    }

    useEffect(() => {
        if (!services.loading && !status.loading) {
            setDeployedBranchFromServicesAndStatus();
        }
        else {
            Promise.all([services.promise, status.promise]).then(() => {
                console.log('in promise all')
                setDeployedBranchFromServicesAndStatus();
            });
        }
    }, [services, status]);

    return <div style={{marginTop:"4pt"}} className="hover-lighten">
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
                <Tooltip id={`tooltip-run-${props.cluster?.cluster_arn}`} position="left" shape="squared" bold={true} size="small" text={"Click to update cluster ..."} />
        </td>
        <td style={{verticalAlign: "top"}} onClick={selectCluster}>
            <div className="box bigmarginbottom lighten" style={{cursor:"default"}}>
                <ToggleShowDetailArrow isShow={isShowDetail} toggleShow={toggleShowDetail} bold={true} text={props.cluster?.env?.name} underline={true}/>
                <small style={{float: "right", marginRight: "2pt"}}>
                    &nbsp;&nbsp;<ExternalLink href={props.cluster.env?.portal_url} />
                </small>
                { (props.cluster?.env?.is_production || props.cluster?.env?.is_staging || props.cluster?.env?.color) &&
                    <small style={{float: "right", color: props.cluster?.env?.color == "blue" ? "blue" : (props.cluster?.env?.color == "green" ? "green" : "")}} onClick={toggleShowDetail}>
                        {props.cluster?.env?.is_production && <b>PRODUCTION</b>}
                        {props.cluster?.env?.is_staging && <b>STAGING</b>}
                        {props.cluster?.env?.color && <>
                            &nbsp;({props.cluster?.env?.color?.toUpperCase()})
                        </>}
                    </small>
                }
                <br />
                <small id={`tooltip-${props.cluster.cluster_arn}`}>
                    {props.cluster?.cluster_arn}&nbsp;<ExternalLink href={awsClusterLink(props.cluster?.cluster_arn)} />
                    { deployedBranch &&
                        <small style={{float: "right", marginRight:"2pt"}}>
                            Branch: <b>{deployedBranch}</b>
                        </small>
                    }
                </small>
                { isSelectedCluster() &&
                    <RedeployButtonsBox cluster={props.cluster}
                        status={status}
                        unselectCluster={props.unselectCluster}
                        isShowDetail={isShowDetail}
                        toggleShowDetail={toggleShowDetail} />
                }
                { isShowDetail() &&
                    <DetailBox services={services} cluster={props.cluster} env={props.cluster?.env} status={status} />
                }
                <Tooltip id={`tooltip-${props.cluster.cluster_arn}`} position="right" shape="squared" size="small" text={"ARN of the AWS cluster definition to be updated."} />
            </div>
        </td></tr></tbody></table>
    </div>
}

const RedeployButtonsBox = (props) => {
    const onClickIgnore = (e) => { e.stopPropagation(); e.preventDefault(); }
    return <>
        <div className="box" style={{background: "inherit", marginTop: "4pt", paddingTop: "8pt"}} onClick={onClickIgnore}>
            <RedeployButtons
                cluster={props.cluster}
                status={props.status}
                unselectCluster={props.unselectCluster}
                isShowDetail={props.isShowDetail}
                toggleShowDetail={props.toggleShowDetail} />
        </div>
    </>
}

const RedeployButtons = (props) => {
    const [confirmed, setConfirmed] = useState(false);
    const [running, setRunning] = useState(false);
    const [runDone, setRunDone] = useState(false);
    const [runResult, setRunResult] = useState(null);
    const fetch = useFetchFunction();
    const onClickCancel = (e) => { setConfirmed(false); e.stopPropagation(); }
    const onClickRedeploy = (e) => {
        if (confirmed) {
            setRunning(true);
            const url = `//aws/ecs/cluster_update/${props.cluster.cluster_arn}`;
            fetch(url, { method: "POST", payload: {}, onDone: (result) => {
                setRunning(false);
                setRunResult(result);
                setRunDone(true);
                props.status.refresh();
            } });
        }
        else {
            setConfirmed(true);
        }
        e.stopPropagation();
    }
    const toggleShowDetail = (e) => props.toggleShowDetail(e);
    const isShowUpdatingButton = () => !props.status.loading && props.status.data?.updating;
    const isShowUpdatingWarning = () => isShowUpdatingButton() && !runResult;
    return <>
        <table style={{width: "100%"}}><tbody><tr><td>
        { confirmed ? <>
            { running ? <div style={{marginTop: "-2pt"}}>
                <StandardSpinner label="Kicking off cluster update"/>
            </div>:<>
                { runDone ? <>
                    <RunResult cluster={props.cluster}
                        running={props.running}
                        runDone={runDone}
                        runResult={runResult}
                        setConfirmed={setConfirmed}
                        setRunDone={setRunDone}
                        isShowUpdatingButton = {isShowUpdatingButton}
                        unselectCluster={props.unselectCluster} />
                </>:<>
                    <RedeployButtonConfirmed
                        cluster={props.cluster}
                        onClickRedeploy={onClickRedeploy}
                        onClickCancel={onClickCancel}
                        running={props.running}
                        isShowDetail={props.isShowDetail}
                        toggleShowDetail={props.toggleShowDetail} />
                </> }
            </> }
        </>: <>
            <RedeployButton
                cluster={props.cluster}
                onClickRedeploy={onClickRedeploy}
                toggleShowDetail={props.toggleShowDetail} />
        </> }
        </td><td>
        { isShowUpdatingButton() ? <>
            <span style={{float: "right"}} className="pointer" onClick={(e) => { if (!props.isShowDetail()) toggleShowDetail(e); props.status.refresh(); }}>
                <UpdatingButton />
            </span>
        </>:<>
            { !props.status.loading &&
                <ToggleShowDetailArrow isShow={props.isShowDetail} toggleShow={props.toggleShowDetail} float="right" text="show details" bold={"onshow"} size={"small"} />
            }
        </> }
        </td></tr></tbody></table>
        { isShowUpdatingWarning() && (!isShowUpdatingButton() || confirmed) && !runResult && <small style={{color: "red"}}>
            <SeparatorH color="red" />
            <b>Warning</b>: A cluseter update appears to be already <u><b>running</b></u>. Run this <u><b>only</b></u> if you know what you are doing!
                <small style={{float: "right"}} className="pointer" onClick={toggleShowDetail}>
                    { props.isShowDetail() ? <>
                        Hide Details {Char.DownArrow}
                    </>:<>
                        <b>Show Details {Char.UpArrow}</b>
                    </> }
                </small>
        </small> }
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
        { !props.isShowUpdatingButton() &&
            <div className="pointer" onClick={onClickRunDoneX} style={{float: "right", marginRight: "2pt"}}><b>{Char.X}</b></div>
        }
        <div className="pointer" onClick={toggleShowJson}>
            { props.runResult.data?.error ? <span style={{color: "red"}}>
                <b>Error kicking off redeploy ...</b>
                <SeparatorH color="red" />
                {props.runResult.data.error}
            </span>:<>
                <b>Kicked off redeploy {Char.RightArrow}</b> <b>{props.runResult?.data?.status === true ? <>OK</> : <>ERROR</>}</b>&nbsp;
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

const RedeployButtonConfirmed = (props) => {
    return <table style={{width: "100%"}}><tbody><tr>
        <td style={{verticalAlign: "top"}}>
            <CancelButton onClickCancel={props.onClickCancel} />
        </td><td style={{verticalAlign: "top", paddingLeft: "8pt"}}>
            <RedeployButton cluster={props.cluster} onClickRedeploy={props.onClickRedeploy} confirmed={true} />
        </td><td style={{verticalAlign: "top", paddingLeft: "0pt", width: "90%"}}>
            <b style={{position: "relative", bottom: "-3pt", whiteSpace: "nowrap"}}>&nbsp;&nbsp;&nbsp;{Char.LeftArrow}&nbsp;
            { props.cluster.type == "deploy" ? <>
                Are you sure you want to redeploy <u>{props.cluster.env.name}</u>?
            </>:<>
                Are you sure you want to redeploy <u>{props.cluster.env.name}</u>?
            </> }
            </b>
        </td>
    </tr></tbody></table>
}

const RedeployButton = (props) => {
    return <div className={`check-run-button ${props.disabled && "disabled"}`} style={{width: "fit-content", border: "1px solid inherit"}} onClick={props?.onClickRedeploy}>
        { props.confirmed && <>&nbsp;Yes:</> }&nbsp;Redeploy&nbsp;
    </div>
}

const CancelButton = (props) => {
    return <div className="check-action-confirm-button" style={{width: "fit-content", marginBottom: "-1pt"}} onClick={props.onClickCancel}>
        &nbsp;<b>Cancel</b>&nbsp;
    </div>
}

const UpdatingButton = (props) => {
    return <span className="updating-button" style={{width: "fit-content", border: "1px solid inherit"}}>
        Updating ...
    </span>
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
    const services = props.services, cluster = props.cluster, status = props.status
    const header = useHeader();
    const health = useFetchPortalHealth();
    return <div className="box bigmargin marginbottom" onClick={(e) => e.stopPropagation()}><small>
        <table style={{fontSize: "inherit"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}}>
                    <ServicesDetails cluster={cluster} services={services} status={status} health={health} />
                </td>
                <TSeparatorV />
                <td style={{verticalAlign: "top"}}>
                    <AccountDetails cluster={cluster} health={health} status={status} />
                </td>
            </tr>
            <TSpaceH />
            { !services.loading &&
                <tr>
                    <td colSpan="5">
                        <ImageAndBuildDetails imageArn={services.data?.image?.arn} />
                    </td>
                </tr>
            }
        </tbody></table>
    </small></div>
}

const AccountDetails = (props) => {
    const header = useHeader();
    const uniqueNonFullEnvNames = () => {
        const env = {};
        ["name", "short_name", "public_name", "foursight_name"].forEach(name => {
            if (props.cluster.env[name] != props.cluster.env.full_name) env[name] = props.cluster.env[name];
        });
        return Array.from(new Set(Object.values(env))).sort((a, b) => b.length - a.length);
    }
    return <table style={{fontSize: "inherit"}}><tbody>
        <tr><td colSpan="2"> AWS Account </td></tr>
        <TSeparatorH double={true} />
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Name: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> {header.app?.credentials?.aws_account_name} </td>
        </tr>
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Number: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}> {header.app?.credentials?.aws_account_number} </td>
        </tr>
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Environment: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}>
                {props.cluster?.env?.full_name}
                {uniqueNonFullEnvNames().map(env => <><br />{env}</>)}
            </td>
        </tr>
        { props.cluster.env?.is_production && <tr>
            <td> Production: </td>
            <td> Yes {props.cluster.env?.color && <>{Char.RightArrow} {Str.Title(props.cluster.env?.color)}</>} </td>
        </tr> }
        { props.cluster.env?.is_staging && <tr>
            <td> Staging: </td>
            <td> Yes {props.cluster.env?.color && <>{Char.RightArrow} {Str.Title(props.cluster.env?.color)}</>} </td>
        </tr> }
        <TSeparatorH top="4pt" bottom="4pt" size="2" />
        <tr>
            <td style={{verticalAlign: "top", fontSize: "small"}}>
                <b>Portal <Refresher bold={false} refresh={() => props.health.refresh({ delay: 1500})} refreshing={() => props.health.loading} />
                <br />Started</b>:
            </td>
            <td style={{whiteSpace: "nowrap"}}>
                {DateTime.Format(props.health.data?.started)} <br />
                <small>{Time.Ago(props.health.data?.started, true, false)}</small>
            </td>
        </tr>
        <TSeparatorH top="4pt" bottom="4pt" size="1" color="gray" />
        <tr>
            <td style={{verticalAlign: "top"}}>
                <b>Portal <Refresher bold={false} refresh={() => props.status.refresh({ delay: 1500})} refreshing={() => props.status.loading} />
                <br />Deployed</b>:
            </td>
            <td style={{whiteSpace: "nowrap"}}>
                {DateTime.Format(props.status.data?.started_at)} <br />
                <small>{Time.Ago(props.status.data?.started_at, true, true)}</small>
            </td>
       </tr>
    </tbody></table>
}

const ServicesDetails = (props) => {
    const updating = () => props.status.data?.updating;
    const serviceStatus = (service_arn) => {
        return props.status?.data?.services?.find(service => service.arn === service_arn);
    }
    return <table style={{fontSize: "inherit"}}><tbody>
        <tr><td /><td width="800pt"/></tr> {/* dummy to make it expand to right */}
        <tr><td colSpan="2">
            <b>AWS Cluster Services</b>
            <span style={{float: "right"}} className="pointer" onClick={() => { props.services.refresh(); props.status.refresh(); props.health.refresh(); }}>
                { !props.status.loading && <>
                    {updating() ? <span style={{color: "red"}}>
                        <b>{Char.Refresh} updating</b> ...
                    </span>:<>
                        <b>{Char.Refresh}</b>
                    </> }
                </> }
            </span>
        </td></tr>
        <TSeparatorH double={true} />
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}>
                Cluster:
            </td>
            <td style={{verticalAlign: "top", whiteSpace: "break-all"}}>
                <span>
                    <b>{props.cluster?.cluster_arn}</b>
                    &nbsp;<small><ExternalLink href={awsClusterLink(props.cluster?.cluster_arn)} /></small>
                </span>
            </td>
        </tr>
        { props.services.loading && <>
            <tr>
                <td> Services: </td>
                <td> <span style={{position: "relative", top: "2px"}}>&nbsp;&nbsp;<PuffSpinnerInline size="16" /></span> </td>
            </tr>
        </> }
        { props.services?.data?.services?.map((service, index) => <>
            <tr>
                <td style={{verticalAlign: "top"}}>
                    Service:
                </td>
                <td style={{verticalAlign: "top"}}>
                    <b>{Str.Title(service.type)}</b>
                    <small>
                        { serviceStatus(service.arn)?.tasks_running_count === 0 ? <>
                            &nbsp;{Char.RightArrow} not running
                        </>:<>
                            &nbsp;{Char.RightArrow} tasks running: {serviceStatus(service.arn)?.tasks_running_count || 0}
                        </> }
                        {serviceStatus(service.arn)?.tasks_pending_count > 0 && <> | tasks pending: {serviceStatus(service.arn)?.tasks_pending_count || 0}</>}
                        {serviceStatus(service.arn)?.tasks_desired_count > 0 && serviceStatus(service.arn)?.tasks_desired_count != serviceStatus(service.arn)?.tasks_running_count && <> | tasks desired: {serviceStatus(service.arn)?.tasks_desired_count || 0}</>}
                        {serviceStatus(service.arn)?.updating && <> | <span style={{color: "red"}}>updating ...</span></>}
                    </small>
                    <br /> {service.arn}&nbsp;<small><ExternalLink href={awsServiceLink(props.cluster.cluster_arn, service.arn)} /></small>
                    <br /> <i>Task Definition: {service.task_definition_arn}</i>&nbsp;<small><ExternalLink href={awsTaskDefinitionLink(service.task_definition_arn)} /></small>
                </td>
            </tr>
        </>)}
        { props.status.data?.last_redeploy_kickoff_at && <>
            <TSeparatorH top="4pt" bottom="4pt" />
            <tr>
                <td colSpan="2">
                    <b>Redeploy last kicked off</b>: <u>{DateTime.Format(props.status.data?.last_redeploy_kickoff_at)}</u>
                    <small>&nbsp;{Char.RightArrow} {Time.Ago(props.status.data?.last_redeploy_kickoff_at, true, true)}</small>
                    { props.status.data?.last_redeploy_kickoff_by && <>
                        <br />
                        Redeploy last kicked off by: {props.status.data.last_redeploy_kickoff_by}
                    </> }
                </td>
            </tr>
        </> }
    </tbody></table>
}

const ImageAndBuildDetails = (props) => {
    const image = useFetchImageInfo(props.imageArn);
    const build = useFetchBuildInfo(props.imageArn);
    const digest = useFetchBuildDigest(build.data?.latest, { cache: true });
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    return <div className="box darken">
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}}>
                    <BuildDetails build={build} image={image.data} />
                </td>
                <TSeparatorV />
                <td style={{verticalAlign: "top"}}>
                    <ImageDetails image={image.data} build={build} digest={digest} />
                </td>
            </tr>
        </tbody></table>
    </div>
}

const ImageDetails = (props) => {
    const image = props.image;
    const header = useHeader();
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    if (!image) return <StandardSpinner label="Loading build info"/>
    return <div>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}} colSpan="2">
                    <b>Image Details</b>
                </td>
            </tr>
            <TSeparatorH double={true} />
            <tr>
                <td style={tdlabel}> ARN: </td>
                <td style={tdcontent}>
                    {image?.arn}
                    &nbsp;<ExternalLink href={awsImageTagLink(header.app?.credentials?.aws_account_number, image?.repo, image?.digest)} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Repo: </td>
                <td style={tdcontent}>
                    {image?.repo}
                    &nbsp;<ExternalLink href={awsImageRepoLink(header.app?.credentials?.aws_account_number, image?.repo)} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Tag: </td>
                <td style={tdcontent}>
                    {image?.tag}
                    &nbsp;<ExternalLink href={awsImageTagLink(header.app?.credentials?.aws_account_number, image?.repo, image?.digest)} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Size: </td>
                <td style={tdcontent}>
                    <span id={`tooltip-size-${image?.digest}`}>
                    {Str.FormatBytes(image?.size)}
                    </span>
                    <Tooltip id={`tooltip-size-${image?.digest}`} position="right" shape="squared" text={`${image?.size} bytes`} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Digest: </td>
                <td style={tdcontent}>
                    <span id={`image-digest-${image?.id}`}>{image?.digest?.replace("sha256:", "")?.substring(0, 32)}</span> ...
                    { props.digest?.data?.digest && image?.digest && <big id={`tooltip-digest-sanity-${props.digest}`}>
                        { props.digest?.data?.digest === image?.digest ?
                            <b style={{color: "green"}}>&nbsp;{Char.Check}</b>
                        :   <b style={{color: "red"}}>&nbsp;{Char.X}</b> }
                        <Tooltip id={`tooltip-digest-sanity-${props.digest}`} text={`This digest and the build digest ${props.digest?.data?.digest !== image?.digest ? "do not" : ""} agree.`} />
                    </big> }
                    <Tooltip id={`image-digest-${image?.id}`} position="bottom" size="small" text={image?.digest} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Pulled: </td>
                <td style={tdcontent}>
                    {DateTime.Format(image?.pulled_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(image?.pulled_at, true, false)}</small>
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Pushed: </td>
                <td style={tdcontent}>
                    {DateTime.Format(image?.pushed_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(image?.pushed_at, true, false)}</small>
                </td>
            </tr>
        </tbody></table>
    </div>
}

const BuildDetails = (props) => {
    const build = props.build;
    const [showPrevious, setShowPrevious] = useState(false);
    const toggleShowPrevious = () => setShowPrevious(!showPrevious);
    const isShowPrevious = () => showPrevious;
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    const header = useHeader();
    return <div>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}} colSpan="2">
                    <b>Build Details</b> {showPrevious && <>(latest)</>}
                    { build.data?.previous && <>
                        <ToggleShowDetailArrow isShow={isShowPrevious} toggleShow={toggleShowPrevious}
                            text="show previous" bold={"onhide"} size="9pt" float="right" right="-2pt" nudge="2pt" />
                    </> }
                </td>
            </tr>
            <TSeparatorH double={true} />
        </tbody></table>
        <BuildInfo build={build.data?.latest} digest={props.digest} image={props.image} fetchDigest={true} />
        { showPrevious && <>
            { build.data?.previous && <>
                <SeparatorH top="2pt" bottom="8pt" color="gray" />
                <table style={{fontSize: "inherit", width: "100%"}}><tbody>
                    <tr> <td style={{verticalAlign: "top"}} colSpan="2"> Build Details (previous) </td> </tr>
                    <TSeparatorH double={true} />
                </tbody></table>
                <BuildInfo build={build.data?.previous} />
            </> }
            { build.data?.next_previous && <>
                <SeparatorH top="2pt" bottom="8pt" color="gray" />
                <table style={{fontSize: "inherit", width: "100%"}}><tbody>
                    <tr> <td style={{verticalAlign: "top"}} colSpan="2"> Build Details (next previous) </td> </tr>
                    <TSeparatorH double={true} />
                </tbody></table>
                <BuildInfo build={build.data?.next_previous} />
            </> }
        </> }
    </div>
}

const BuildDigest = (props) => {
    const digest = useFetchBuildDigest(props.build, { nofetch: !props.fetch, cache: true });
    return <span>
        { digest.loading ? <>
            <i>Fetching </i>&nbsp;<PuffSpinnerInline size="14" />
        </>:<>
            {digest.data?.digest ? <span  id={`tooltip-${digest.data?.digest}`} >
                {digest.data?.digest?.replace("sha256:", "")?.substring(0, 32)} ...
                <Tooltip id={`tooltip-${digest.data?.digest}`} text={digest.data?.digest}/>
            </span>:<>
                <span onClick={digest.fetch} className="pointer">
                    <i>Click to fetch ...</i>
                </span>
            </> }
            { props.image && <big id={`tooltip-digest-build-sanity-${props.digest}`}>
                { props.image?.digest === digest.data?.digest ?
                    <b style={{color: "green"}}>&nbsp;{Char.Check}</b>
                :   <b style={{color: "red"}}>&nbsp;{Char.X}</b> }
                <Tooltip id={`tooltip-digest-build-sanity-${props.digest}`} text={`This digest and the build digest ${props.image?.digest !== digest.data?.digest ? "do not" : ""} agree.`} />
            </big> }
            <span className="pointer" onClick={digest.refresh}>
                &nbsp;{Char.Refresh}
            </span>
        </> }
    </span>
}

function toPixelSize(value) {
    if (value.endsWith("px")) return value;
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) throw new Error("Invalid size format");
    return numericValue * 1.5;
}

function normalizeFontSize(value) {
    if (value === "xx-small") return "8pt";
    else if (value === "x-small") return "10pt";
    else if (value === "small") return "13pt";
    else if (value === "medium") return "16pt";
    else if (value === "large") return "18pt";
    else if (value === "x-large") return "24pt";
    else if (value === "xx-large") return "32pt";
    else if (/^\d+$/.test(value)) return `${value}pt`;
    else return value;
}

const Refresher = ({ refresh = () => null, refreshing = () => false, bold = false, size = "x-small", nudge = "0px" }) => {
    const fontSize = normalizeFontSize(size)
    const spinnerSize = toPixelSize(fontSize);
    return <span className="pointer" onClick={(e) => { refresh(); e.stopPropagation(); e.preventDefault(); }}>
        { refreshing() ? <>
            <span style={{position: "relative", top: "1px"}}><PuffSpinnerInline size={`${spinnerSize}`} /></span>
        </>:<span style={{position: "relative", top: "0px", fontSize: `${fontSize}`, fontWeight: bold ? "bold" : "inherit"}}>
            {Char.Refresh}
        </span> }
    </span>
}

const BuildInfo = (props) => {
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    const header = useHeader();
    if (!props.build) return <StandardSpinner label="Loading build info"/>
    return <>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={tdlabel}> ID: </td>
                <td style={tdcontent}>
                    <span id={`tooltip-buildno-${props.build?.number}`}>{props.build?.log_stream}</span>
                    &nbsp;<ExternalLink href={awsCodebuildLogLink(header.app?.credentials?.aws_account_number, props.build?.project, props.build?.log_group, props.build?.log_stream)} nudgedown="1px" />
                    <Tooltip id={`tooltip-buildno-${props.build?.number}`} text={`Build number: ${props.build?.number}`} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Initiator: </td>
                <td style={tdcontent}> {props.build?.initiator} </td>
            </tr>
            <tr>
                <td style={tdlabel}> Project: </td>
                <td style={tdcontent}>
                    {props.build?.project}
                    &nbsp;<ExternalLink href={awsCodebuildProjectLink(header.app?.credentials?.aws_account_number, props.build?.project)} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> GitHub: </td>
                <td style={tdcontent}>
                    {props.build?.github}
                    &nbsp;<ExternalLink href={props.build?.github} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Branch: </td>
                <td style={tdcontent}>
                    <b>{props.build?.branch}</b>
                    &nbsp;<ExternalLink href={`${props.build?.github}/tree/${props.build?.branch}`} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Commit: </td>
                <td style={tdcontent}>
                    {props.build?.commit}
                    &nbsp;<ExternalLink href={`${props.build?.github}/commit/${props.build?.commit}`} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Digest: </td>
                <td style={tdlabel}> <BuildDigest build={props.build} image={props.image} fetch={props.fetchDigest} /></td>
            </tr>
            <tr>
                <td style={tdlabel}> Status: </td>
                <td style={tdcontent}>
                    {props.build?.status}
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Started: </td>
                <td style={tdcontent}>
                    {DateTime.Format(props.build?.started_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(props.build?.started_at, true, false)}</small>
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Finished: </td>
                <td style={tdcontent}>
                    {DateTime.Format(props.build?.finished_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(props.build?.finished_at, true, false)}</small>
                </td>
            </tr>
        </tbody></table>
    </>
}

export default PortalRedeployPage;
