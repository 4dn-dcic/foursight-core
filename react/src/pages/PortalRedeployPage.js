import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Char from '../utils/Char'; 
import DateTime from '../utils/DateTime';
import Duration from '../utils/Duration';
import { ExternalLink } from '../Components'; 
import Image from '../utils/Image';
import { PuffSpinnerInline, StandardSpinner } from '../Spinners';
import { Refresher } from '../Components'; 
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

function awsClusterTagsLink(id) {
    return `https://${region}.console.aws.amazon.com/ecs/v2/clusters/${id}/tags`;
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

function awsCodebuildFullLogLink(account_number, project, logGroup, logStream) {
    return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:log-groups/log-group/${encodeURIComponent(logGroup)}/log-events/${logStream}`;
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
    const url = "//aws/ecs/clusters_for_update";
    return useFetch(url, { onData: (data) => { if (onData) onData(data); return data; } });
}

const useFetchServices = (clusterArn, args = {}) => {
    const url = `//aws/ecs/services_for_update/${clusterArn}?include_image=false&include_build=false`;
    return useFetch(url, { ...args, cache: true });
}

const useFetchStatus = (clusterArn, args = {}) => {
    const url = `//aws/ecs/cluster_status/${clusterArn}`;
    return useFetch(url, { ...args, cache: true });
}

const useFetchImageInfo = (imageArn, args = {}) => {
    const url = imageArn ? `//aws/ecr/image/${encodeURIComponent(imageArn)}` : null;
    return useFetch(url, { ...args, cache: true });
}

const useFetchBuildInfo = (imageArn, previousBuilds = 2, args = {}) => {
    const url = imageArn ? `//aws/ecr/build/${encodeURIComponent(imageArn)}?previous_builds=${previousBuilds}` : null;
    return useFetch(url, { ...args, cache: true });
}

const useFetchBuildDigest = (build, args = {}) => {
    const logGroup = build?.log_group;
    const logStream = build?.log_stream;
    const imageTag = build?.image_tag;
    const url = imageTag ? `//aws/codebuild/digest/${encodeURIComponent(logGroup)}/${logStream}?image_tag=${imageTag}` : null;
    return useFetch(url, args);
}

const useFetchPortalHealth = (env) => {
    const url = env ? `//${env}/portal_health` : null;
    return useFetch(url);
}

const PortalRedeployPage = (props) => {

    const [args, setArgs] = useSearchParams();
    const previousBuilds = args.get("previous_builds") || 2;

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
    const setHideDetail = (cluster) => { showDetails[cluster.cluster_arn] = false; setShowDetails({...showDetails}); }
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
                    setShowDetail={setShowDetail}
                    setHideDetail={setHideDetail}
                    previousBuilds={previousBuilds} />
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
    const selectCluster = (cluster) => { if (isSelectedCluster(cluster)) { setSelectedCluster(null); return false; } else { setSelectedCluster(cluster.cluster_arn); return true; } }
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
                setShowDetail={props.setShowDetail}
                setHideDetail={props.setHideDetail}
                previousBuilds={props.previousBuilds} />
        )}
    </div>
}

const PortalRedeployBox = (props) => {

    const showHideDetailOnSelectCluster = true;

    const isShowDetail = () => props.isShowDetail(props.cluster);
    const toggleShowDetail = (e) => {
        props.toggleShowDetail(props.cluster);
        if (e) { e.stopPropagation(); e.preventDefault(); }
    }
    const isSelectedCluster = () => props.isSelectedCluster(props.cluster);
    const selectCluster = () =>  {
        if (props.selectCluster(props.cluster)) {
            if (showHideDetailOnSelectCluster) {
                props.setShowDetail(props.cluster);
            }
        }
        else {
            if (showHideDetailOnSelectCluster) {
                props.setHideDetail(props.cluster);
            }
        }
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
                </small>
                <WarningUnknownService services={services.data?.unknown_services} clusterArn={props.cluster.cluster_arn} />
                { isSelectedCluster() &&
                    <RedeployButtonsBox cluster={props.cluster}
                        status={status}
                        unselectCluster={props.unselectCluster}
                        isShowDetail={isShowDetail}
                        toggleShowDetail={toggleShowDetail}
                        deployedBranch={deployedBranch} />
                }
                { isShowDetail() &&
                    <DetailBox services={services} cluster={props.cluster} env={props.cluster?.env} status={status} setDeployedBranch={setDeployedBranch} previousBuilds={props.previousBuilds} />
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
                toggleShowDetail={props.toggleShowDetail}
                deployedBranch={props.deployedBranch} />
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
            { !props.status.loading && <>
                { props.deployedBranch ? <small style={{float: "right"}}>
                    Branch:&nbsp;<ToggleShowDetailArrow isShow={props.isShowDetail} toggleShow={props.toggleShowDetail} text={props.deployedBranch} bold={"onshow"} size={"small"} />
                </small>:
                    <ToggleShowDetailArrow isShow={props.isShowDetail} toggleShow={props.toggleShowDetail} float="right" bold={"onshow"} size={"small"} />
                }
            </> }
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
    const services = props.services;
    const cluster = props.cluster;
    const status = props.status;
    const [previousBuilds, setPreviousBuilds] = useState(props.previousBuilds);
    const setMoreBuilds = (more) => {
        setPreviousBuilds(more ? props.previousBuilds + 7 : props.previousBuilds);
    }
    const image = useFetchImageInfo(services.data?.image?.arn);
    const build = useFetchBuildInfo(services.data?.image?.arn, previousBuilds);
    const header = useHeader();
    const health = useFetchPortalHealth(services.data?.env?.full_name);

    useEffect(() => {
        if (!build.loading && !status.loading) {
            props.setDeployedBranch(build.data?.latest?.branch);
        }
    }, [build, status]);

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
                        <ImageAndBuildDetails imageArn={services.data?.image?.arn} image={image} build={build} setMoreBuilds={setMoreBuilds} />
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
                <span id={`tooltip-env-${props.cluster.cluster_arn}`}>
                    {uniqueNonFullEnvNames().map(env => <><br />{env}</>)}
                </span>
                <Tooltip id={`tooltip-env-${props.cluster.cluster_arn}`} position="top" text={`These are environment name aliases.`} />
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
            <td style={{verticalAlign: "top"}}>
                <b>Portal <Refresher bold={false} refresh={props.health.refresh} refreshing={() => props.health.loading} />
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
                <b>Portal <Refresher bold={false} refresh={props.status.refresh} refreshing={() => props.status.loading} />
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
    const serviceStatus = (service_arn) => props.status?.data?.services?.find(service => service.arn === service_arn);
    return <table style={{fontSize: "inherit"}}><tbody>
        <tr><td /><td width="800pt"/></tr> {/* dummy to make it expand to right */}
        <tr><td colSpan="2">
            <b>AWS Cluster Services</b>
            { updating() && <b>
                &nbsp;{Char.RightArrow}&nbsp;<i style={{color: "red"}}>Updating ...</i>
            </b> }
            <span style={{float: "right"}}>
                <Refresher bold={true}
                    refresh={() => { props.services.refresh(); props.status.refresh(); props.health.refresh(); }}
                    refreshing={() => props.services.loading || props.status.loading || props.health.loading} />
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
        { props.services.loading ? <>
            <tr>
                <td> Services: </td>
                <td> <span style={{position: "relative", top: "2px"}}>&nbsp;&nbsp;<PuffSpinnerInline size="16" /></span> </td>
            </tr>
        </>:<>
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
                        {serviceStatus(service.arn)?.updating && <> | <i style={{color: "red"}}>updating ...</i></>}
                    </small>
                    <br /> {service.arn}&nbsp;<small><ExternalLink href={awsServiceLink(props.cluster.cluster_arn, service.arn)} /></small>
                    <br /> <i>Task Definition: {service.task_definition_arn}</i>&nbsp;<small><ExternalLink href={awsTaskDefinitionLink(service.task_definition_arn)} /></small>
                </td>
            </tr>
        </>)}
        { props.status.data?.last_redeploy_kickoff_at && <>
            <TSeparatorH size="2" top="4pt" bottom="4pt" />
            <tr>
                <td colSpan="2">
                    <table><tbody style={{fontSize: "small"}}>
                        <tr>
                            <td>
                                <b id={`tooltip-last-redeployed-${props.cluster.cluster_arn}`} >Last redeployed</b>:&nbsp;
                                <Tooltip id={`tooltip-last-redeployed-${props.cluster.cluster_arn}`} position="top" text={`Last redeployed using this UI.`} />
                            </td>
                            <td>
                                <u>{DateTime.Format(props.status.data?.last_redeploy_kickoff_at)}</u>
                                <small>&nbsp;{Char.RightArrow} {Time.Ago(props.status.data?.last_redeploy_kickoff_at, true, true)}</small>
                                &nbsp;&nbsp;<ExternalLink href={awsClusterTagsLink(props.cluster.cluster_arn)} nudgedown="1px" />
                            </td>
                        </tr>
                        { props.status.data?.last_redeploy_kickoff_by && <>
                            <tr>
                                <td>Last redeployed by:&nbsp;</td>
                                <td>
                                    {props.status.data.last_redeploy_kickoff_by.toLowerCase()}
                                </td>
                            </tr>
                        </> }
                        { props.status.data?.last_redeploy_kickoff_repo && <>
                            <tr>
                                <td style={{whiteSpace: "nowrap", verticalAlign: "top"}}>Last redeployed code:&nbsp;</td>
                                <td>
                                    <span id={`tooltip-repo-${props.status.data.last_redeploy_kickoff_commit}`} >
                                        {props.status.data.last_redeploy_kickoff_repo.replace("https://github.com/", "")}
                                        &nbsp;<ExternalLink href={props.status.data.last_redeploy_kickoff_repo} />
                                        <Tooltip id={`tooltip-repo-${props.status.data.last_redeploy_kickoff_commit}`} position="bottom" text="Redeployed GitHub repo." />
                                    </span>
                                    { props.status.data?.last_redeploy_kickoff_branch &&
                                        <span id={`tooltip-branch-${props.status.data.last_redeploy_kickoff_commit}`} >
                                            &nbsp;|&nbsp;
                                            {props.status.data.last_redeploy_kickoff_branch}
                                            &nbsp;<ExternalLink href={`${props.status.data.last_redeploy_kickoff_repo}/tree/${props.status.data.last_redeploy_kickoff_branch}`} />
                                            <Tooltip id={`tooltip-branch-${props.status.data.last_redeploy_kickoff_commit}`} position="bottom" text="Redeployed GitHub repo branch." />
                                        </span>
                                    }
                                    { props.status.data?.last_redeploy_kickoff_commit &&
                                        <span id={`tooltip-commit-${props.status.data.last_redeploy_kickoff_commit}`} >
                                            &nbsp;|&nbsp;
                                            {props.status.data.last_redeploy_kickoff_commit.substring(0, 16)}
                                            &nbsp;<ExternalLink href={`${props.status.data.last_redeploy_kickoff_repo}/commit/${props.status.data.last_redeploy_kickoff_commit}`} />
                                            <Tooltip id={`tooltip-commit-${props.status.data.last_redeploy_kickoff_commit}`} position="bottom" text={`Redeployed GitHub repo commit: ${props.status.data.last_redeploy_kickoff_commit}`} />
                                        </span>
                                    }
                                </td>
                            </tr>
                        </> }
                    </tbody></table>
                </td>
            </tr>
        </> }
    </> }
    </tbody></table>
}

const ImageAndBuildDetails = (props) => {
    const image = props.image;
    const build = props.build;
    const digest = useFetchBuildDigest(build.data?.latest, { cache: true });
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    return <div className="box darken">
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}}>
                    <BuildDetails build={build} image={image.data} setMoreBuilds={props.setMoreBuilds} />
                </td>
                <TSeparatorV />
                <td style={{verticalAlign: "top"}}>
                    <ImageDetails image={image} build={build} digest={digest} />
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
    return <div>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}} colSpan="2">
                    <b>Image Details</b>
                    <span style={{float: "right"}}>
                        <Refresher bold={true} refresh={image.refresh} refreshing={() => image.loading} />
                    </span>
                </td>
            </tr>
            <TSeparatorH double={true} />
            { image.loading ? <>
                <StandardSpinner label="Loading image info"/>
            </>:<>
            <tr>
                <td style={tdlabel}> ARN: </td>
                <td style={tdcontent}>
                    {image.data?.arn}
                    &nbsp;<ExternalLink href={awsImageTagLink(header.app?.credentials?.aws_account_number, image.data?.repo, image.data?.digest)} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Repo: </td>
                <td style={tdcontent}>
                    {image.data?.repo}
                    &nbsp;<ExternalLink href={awsImageRepoLink(header.app?.credentials?.aws_account_number, image.data?.repo)} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Tag: </td>
                <td style={tdcontent}>
                    {image.data?.tag}
                    &nbsp;<ExternalLink href={awsImageTagLink(header.app?.credentials?.aws_account_number, image.data?.repo, image.data?.digest)} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Size: </td>
                <td style={tdcontent}>
                    <span id={`tooltip-size-${image.data?.digest}`}>
                    {Str.FormatBytes(image.data?.size)}
                    </span>
                    <Tooltip id={`tooltip-size-${image.data?.digest}`} position="right" shape="squared" text={`${image.data?.size} bytes`} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Digest: </td>
                <td style={tdcontent}>
                    <span id={`image-digest-${image.data?.id}`}>{image.data?.digest?.replace("sha256:", "")?.substring(0, 32)}</span> ...
{/*
                    { props.digest?.data?.digest && image.data?.digest && <big id={`tooltip-digest-sanity-${props.digest}`}>
                        { props.digest?.data?.digest === image.data?.digest ?
                            <b style={{color: "green"}}>&nbsp;{Char.Check}</b>
                        :   <b style={{color: "red"}}>&nbsp;{Char.X}</b> }
                        <Tooltip id={`tooltip-digest-sanity-${props.digest}`} text={`This digest and the build digest ${props.digest?.data?.digest !== image.data?.digest ? "do not" : ""} agree.`} />
                    </big> }
*/}
                    <Tooltip id={`image-digest-${image.data?.id}`} position="bottom" size="small" text={image.data?.digest} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Pulled: </td>
                <td style={tdcontent}>
                    {DateTime.Format(image.data?.pulled_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(image.data?.pulled_at, true, false)}</small>
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Pushed: </td>
                <td style={tdcontent}>
                    {DateTime.Format(image.data?.pushed_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(image.data?.pushed_at, true, false)}</small>
                </td>
            </tr>
            </> }
        </tbody></table>
    </div>
}

const BuildDetails = (props) => {
    const build = props.build;
    const [showPrevious, setShowPrevious] = useState(false);
    const toggleShowPrevious = () => setShowPrevious(!showPrevious);
    const isShowPrevious = () => showPrevious;
    const [moreBuilds, setMoreBuilds] = useState(false);
    const toggleMoreBuilds = () => {
         const more = moreBuilds;
         props.setMoreBuilds(!more);
         setMoreBuilds(!more);
    }
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    const header = useHeader();
    return <div>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}} colSpan="2">
                    <b id={`tooltip-build-details-${build.data?.latest?.commit}`}
                        className="pointer" onClick={toggleShowPrevious}>Build Details</b>&nbsp;<ToggleShowDetailArrow isShow={isShowPrevious} toggleShow={toggleShowPrevious} bold={true} size="9pt"/>
                    <Tooltip id={`tooltip-build-details-${build.data?.latest?.commit}`} position="top" text={`Click to ${isShowPrevious() ? "hide" : "show" } more builds.`}/>
                    <span style={{float: "right"}}>
                        <Refresher bold={true} refresh={build.refresh} refreshing={() => build.loading} />
                    </span>
                </td>
            </tr>
            <TSeparatorH double={true} />
        </tbody></table>
        { build.loading ? <>
            <StandardSpinner label="Loading build info" />
        </>:<>
            <BuildInfo build={build} digest={props.digest} image={props.image} fetchDigest={true} which="latest" expanded={showPrevious} />
            { showPrevious && build.data?.others?.length > 0 && <>
                { build.data?.others?.map((other, index) => <>
                    <SeparatorH top="2pt" bottom="8pt" color="gray" />
                    <table style={{fontSize: "inherit", width: "100%"}}><tbody>
                        <tr><td style={{verticalAlign: "top"}} colSpan="2">
                            Build Details&nbsp;{Char.Diamond}&nbsp;
                            { index == 0 ? <>Previous</> : <>{ index == 1 ? <>Next Previous</> : <>{DateTime.Format(other.finished_at)}</> }</> }
                            { index == build.data.others.length - 1 &&
                                <span style={{float: "right"}} className="pointer" onClick={toggleMoreBuilds} id={`tooltip-more-${build.data?.latest?.commit}`} >
                                    <b>{ moreBuilds ? <>less</> : <>more</> }</b>
                                    <Tooltip id={`tooltip-more-${build.data?.latest?.commit}`} position="top" text={`Click to show ${!moreBuilds ? "even more" : "fewer"} builds.`}/>
                                </span>
                            }
                        </td></tr>
                        <TSeparatorH double={true} />
                    </tbody></table>
                    <BuildInfo build={build} which={other} index={index} expanded={showPrevious} />
                </> )}
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
            &nbsp;<Refresher bold={true} refresh={digest.refresh} refreshing={() => digest.loading} />
            { props.image && <big id={`tooltip-digest-build-sanity-${props.digest}`}>
                { props.image?.digest === digest.data?.digest && <b style={{color: "green"}}>&nbsp;{Char.Check}</b> }
                <Tooltip id={`tooltip-digest-build-sanity-${props.digest}`} text={`This digest and the image digest ${props.image?.digest !== digest.data?.digest ? "do not" : ""} match.`} />
            </big> }
        </> }
    </span>
}

const BuildInfo = (props) => {
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    const header = useHeader();

    if (props.build.loading) return <></>

    const build = Str.HasValue(props.which) ? props.build.get(props.which) : props.which;
;
    return <>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={tdlabel}> ID: </td>
                <td style={tdcontent}>
                    <span id={`tooltip-buildno-${build?.number}`}>{build?.log_stream}</span>
                    &nbsp;<ExternalLink href={awsCodebuildLogLink(header.app?.credentials?.aws_account_number, build?.project, build?.log_group, build?.log_stream)} />
                    <Tooltip id={`tooltip-buildno-${build?.number}`} position="top" text={`Build number: ${build?.number}`} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Initiator: </td>
                <td style={tdcontent}> {build?.initiator?.toLowerCase()} </td>
            </tr>
            <tr>
                <td style={tdlabel}> Project: </td>
                <td style={tdcontent}>
                    {build?.project}
                    &nbsp;<ExternalLink href={awsCodebuildProjectLink(header.app?.credentials?.aws_account_number, build?.project)} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> GitHub: </td>
                <td style={tdcontent}>
                    {build?.github}
                    &nbsp;<ExternalLink href={build?.github} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Branch: </td>
                <td style={tdcontent}>
                    <b>{build?.branch}</b>
                    &nbsp;<ExternalLink href={`${build?.github}/tree/${build?.branch}`} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Commit: </td>
                <td style={tdcontent}>
                    {build?.commit}
                    &nbsp;<ExternalLink href={`${build?.github}/commit/${build?.commit}`} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Digest: </td>
                <td style={tdlabel}> <BuildDigest build={build} image={props.image} fetch={props.fetchDigest} /></td>
            </tr>
            <tr>
                <td style={tdlabel}> Status: </td>
                <td style={tdcontent}>
                    {build?.status}
                    &nbsp;|&nbsp;Build Number:&nbsp;{build?.number}
                    &nbsp;|&nbsp;Logs&nbsp;<ExternalLink href={awsCodebuildFullLogLink(header.app?.credentials?.aws_account_number, build?.project, build?.log_group, build?.log_stream)} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Started: </td>
                <td style={tdcontent}>
                    {DateTime.Format(build?.started_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(build?.started_at, true, false)}</small>
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Finished: </td>
                <td style={tdcontent}>
                    <span style={{...tdlabel, fontWeight: props.expanded ? "bold" : "inherit"}}>{DateTime.Format(build?.finished_at)}</span>
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(build?.finished_at, true, false)}</small>
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Duration: </td>
                <td style={tdcontent}>
                    {Time.FormatDuration(build?.started_at, build?.finished_at, true)}
                </td>
            </tr>
        </tbody></table>
    </>
}

const WarningUnknownService = (props) => {
    return <>
        { props?.services &&
            <div className="box thickborder error" style={{fontSize: "small", marginTop: "3pt", marginBottom: "4pt"}}>
                <b>Warning: Unknown service{props.services.length !== 1 ? "s" : ""} found</b>
                &nbsp;{Char.RightArrow}&nbsp;{props.services.length !== 1 ? "These" : "This"} will be ignored on redeploy.
                <br />
                <SeparatorH top="4pt" bottom="4pt" color="darkred" />
                { props.services.map((service, index) => <>
                    Service ARN: <b>{service.arn}</b> <ExternalLink href={awsServiceLink(props.clusterArn, service.arn)} color="darkred" nudge="1px" /> <br />
                </> )}
            </div>
        }
    </>
}

export default PortalRedeployPage;
