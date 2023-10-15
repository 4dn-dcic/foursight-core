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

function awsCodebuildLogLink(account_number, project, log_group, log_stream) {
    return `https://${region}.console.aws.amazon.com/codesuite/codebuild/${account_number}/projects/${project}/build/${project}:${log_stream}/?region=${region}`;
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
                <small id={`tooltip-${props.cluster.cluster_arn}`}> {props.cluster?.cluster_arn}&nbsp;<ExternalLink href={awsClusterLink(props.cluster?.cluster_arn)} /></small>
                { isSelectedCluster() &&
                    <RedeployButtonsBox cluster={props.cluster}
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

const RedeployButtonsBox = (props) => {
    const onClickIgnore = (e) => { e.stopPropagation(); e.preventDefault(); }
    return <>
        <div className="box" style={{background: "inherit", marginTop: "4pt", paddingTop: "8pt"}} onClick={onClickIgnore}>
            <RedeployButtons
                cluster={props.cluster}
                unselectCluster={props.unselectCluster}
                isShowDetail={props.isShowDetail}
                toggleShowDetail={props.toggleShowDetail} />
        </div>
    </>
}

const RedeployButtonsBoxDisabled = (props) => {
    return <>
        <div className="box bigmargin" style={{background: "inherit", marginTop: "6pt", paddingTop: "8pt", color: "red"}}>
            <b>Redeploy disabled due to errors.</b>
        </div>
    </>
}

const RedeployButtonsClusterStatusLoading = (props) => {
    return <>
        <table><tbody><tr><td>
            <RedeployButton cluster={props.cluster} disabled={true} />
        </td><td style={{paddingLeft: "8pt"}}>
            <StandardSpinner label="Fetching cluster status" />
        </td></tr></tbody></table>
    </>
}

const RedeployButtons = (props) => {
    const [confirmed, setConfirmed] = useState(false);
    const [running, setRunning] = useState(false);
    const [runDone, setRunDone] = useState(false);
    const [runResult, setRunResult] = useState(false);
    const fetch = useFetchFunction();
    const onClickCancel = (e) => { setConfirmed(false); e.stopPropagation(); }
    const onClickRedeploy = (e) => {
        if (confirmed) {
            setRunning(true);
            const url = `//aws/ecs/cluster_update/${props.cluster.cluster_arn}`;
            fetch(url, { method: "POST", onDone: (result) => {
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
                <StandardSpinner label="Kicking off cluster update"/>
            </div>:<>
                { runDone ? <>
                    <RunResult cluster={props.cluster}
                        running={props.running}
                        runDone={runDone}
                        runResult={runResult}
                        setConfirmed={setConfirmed}
                        setRunDone={setRunDone}
                        unselectCluster={props.unselectCluster} />
                </>:<>
                    <RedeployButtonConfirmed cluster={props.cluster} onClickRedeploy={onClickRedeploy} onClickCancel={onClickCancel} running={props.running} />
                </> }
            </> }
        </>: <>
            <RedeployButton cluster={props.cluster} onClickRedeploy={onClickRedeploy} />
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
                <b>Error kicking off redeploy ...</b>
                <SeparatorH color="red" />
                {props.runResult.data.error}
            </span>:<>
                <b>Kicked off redeploy {Char.RightArrow}</b> <small><u>{props.runResult?.data?.task_running_id}</u></small>&nbsp;
                <small><ExternalLink href={awsClusterLink(props.cluster.cluster_arn, props.runResult?.data?.task_running_id)} /></small>
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
    return <table><tbody><tr>
        <td style={{verticalAlign: "top"}}>
            <CancelButton onClickCancel={props.onClickCancel} />
        </td><td style={{verticalAlign: "top", paddingLeft: "8pt"}}>
            <RedeployButton cluster={props.cluster} onClickRedeploy={props.onClickRedeploy} confirmed={true} />
        </td><td style={{verticalAlign: "top", paddingLeft: "0pt"}}>
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
    const services = useFetch(`//aws/ecs/services_for_update/${props.cluster?.cluster_arn}`);
    return <div className="box bigmargin marginbottom" onClick={(e) => e.stopPropagation()}><small>
        <table style={{fontSize: "inherit"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}}>
                    <ServicesDetails cluster={props.cluster} services={services} />
                </td>
                <TSeparatorV />
                <td style={{verticalAlign: "top"}}>
                    <AccountDetails cluster={props.cluster} />
                </td>
            </tr>
            <TSpaceH />
            { !services.loading &&
                <tr>
                    <td colSpan="5">
                        <ImageAndBuildDetails services={services} />
                    </td>
                </tr>
            }
        </tbody></table>
    </small></div>
}

const AccountDetails = (props) => {
    const header = useHeader();
    const uniqueEnvNames = () => {
        const env = {};
        ["name", "short_name", "public_name", "foursight_name"].forEach(name => {
            env[name] = props.cluster.env[name];
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
        { props.cluster.env?.is_production && <tr>
            <td> Production: </td>
            <td> Yes </td>
        </tr> }
        { props.cluster.env?.is_staging && <tr>
            <td> Staging: </td>
            <td> Yes </td>
        </tr> }
        <tr>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap", paddingRight:"4pt"}}> Environment: </td>
            <td style={{verticalAlign: "top", whiteSpace: "nowrap"}}>
                {props.cluster?.env?.full_name}
                {uniqueEnvNames().map(env => <><br />{env}</>)}
            </td>
        </tr>
    </tbody></table>
}

const ServicesDetails = (props) => {
    return <table style={{fontSize: "inherit"}}><tbody>
        <tr><td /><td width="800pt"/></tr> {/* dummy to make it expand to right */}
        <tr><td colSpan="2"> AWS Services
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
                    <b>{service.type.toUpperCase()}</b>
                    <br /> {service.arn}&nbsp;<small><ExternalLink href={awsServiceLink(props.cluster.cluster_arn, service.arn)} /></small>
                    <br /> <i>Task Definition: {service.task_definition_arn}</i>&nbsp;<small><ExternalLink href={awsTaskDefinitionLink(service.task_definition_arn)} /></small>
                </td>
            </tr>
        </>)}
    </tbody></table>
}

const ImageAndBuildDetails = (props) => {
    const image_tag = props.services.data?.image?.tag;
    const log_group = props.services.data?.build?.latest?.log_group;
    const log_stream = props.services.data?.build?.latest?.log_stream;
    const digest = useFetch(`//aws/codebuild/digest/${image_tag}/${encodeURIComponent(log_group)}/${log_stream}`);
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    return <div className="box darken">
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}}>
                    <BuildDetails services={props.services} digest={digest} />
                </td>
                <TSeparatorV />
                <td style={{verticalAlign: "top"}}>
                    <ImageDetails services={props.services} digest={digest} />
                </td>
            </tr>
        </tbody></table>
    </div>
}

const ImageDetails = (props) => {
    const header = useHeader();
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    return <div>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}} colSpan="2">
                    Image Details
                </td>
            </tr>
            <TSeparatorH double={true} />
            <tr>
                <td style={tdlabel}> ARN: </td>
                <td style={tdcontent}>
                    {props.services.data?.image?.arn}
                    &nbsp;<ExternalLink href={awsImageTagLink(header.app?.credentials?.aws_account_number, props.services.data?.image?.repo, props.services.data?.image?.digest)} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Repo: </td>
                <td style={tdcontent}>
                    {props.services.data?.image?.repo}
                    &nbsp;<ExternalLink href={awsImageRepoLink(header.app?.credentials?.aws_account_number, props.services.data?.image?.repo)} nudgedown="1px" />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Tag: </td>
                <td style={tdcontent}>
                    {props.services.data?.image?.tag}
                    &nbsp;<ExternalLink href={awsImageTagLink(header.app?.credentials?.aws_account_number, props.services.data?.image?.repo, props.services.data?.image?.digest)} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Size: </td>
                <td style={tdcontent}>
                    <span id={`tooltip-${props.services.data?.image?.digest}`}>
                    {Str.FormatBytes(props.services.data?.image?.size)}
                    </span>
                    <Tooltip id={`tooltip-${props.services.data?.image?.digest}`} position="right" shape="squared" text={`${props.services.data?.image?.size} bytes`} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Digest: </td>
                <td style={tdcontent}>
                    <span id={`image-digest-${props.services.data?.image?.id}`}>
                        {props.services.data?.image?.digest?.replace("sha256:", "")?.substring(0, 32)} ...
                        { props.digest.data?.digest && props.services.data?.image?.digest && <>
                            { props.digest.data?.digest === props.services.data?.image?.digest ?
                                <b style={{color: "green"}}>&nbsp;{Char.Check}</b>
                            :   <b style={{color: "red"}}>&nbsp;{Char.X}</b> }
                        </> }
                    </span>
                    <Tooltip id={`image-digest-${props.services.data?.image?.id}`} position="bottom" size="small" text={props.services.data?.image?.digest} />
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Pulled: </td>
                <td style={tdcontent}>
                    {DateTime.Format(props.services.data?.image?.pulled_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(props.services.data?.image?.pulled_at, true, false)}</small>
                </td>
            </tr>
            <tr>
                <td style={tdlabel}> Pushed: </td>
                <td style={tdcontent}>
                    {DateTime.Format(props.services.data?.image?.pushed_at)}
                    <small>&nbsp;{Char.RightArrow}&nbsp;{Time.Ago(props.services.data?.image?.pushed_at, true, false)}</small>
                </td>
            </tr>
        </tbody></table>
    </div>
}

const BuildDetails = (props) => {
    const [showPrevious, setShowPrevious] = useState(false);
    const toggleShowPrevious = () => setShowPrevious(!showPrevious);
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    const header = useHeader();
    return <div>
        <table style={{fontSize: "inherit", width: "100%"}}><tbody>
            <tr>
                <td style={{verticalAlign: "top"}} colSpan="2">
                    Build Details {showPrevious && <>(latest)</>}
                    { props.services.data?.build?.previous &&
                        <small style={{float: "right", position: "relative", top: "2pt", right: "-2pt"}} className="pointer" onClick={toggleShowPrevious}>
                            <span>{showPrevious ? <>hide previous</> : <b>show previous</b>}</span>
                            <span style={{paddingLeft:"1pt"}}>{showPrevious ? <>{Char.DownArrow}</> : <>{Char.UpArrow}</>}</span>
                        </small>
                    }
                </td>
            </tr>
            <TSeparatorH double={true} />
        </tbody></table>
        <BuildInfo build={props.services.data?.build?.latest} digest={props.digest.data?.digest} image={props.services.data?.image} />
        { showPrevious && <>
            { props.services.data?.build?.previous && <>
                <SeparatorH top="2pt" bottom="8pt" color="gray" />
                <table style={{fontSize: "inherit", width: "100%"}}><tbody>
                    <tr> <td style={{verticalAlign: "top"}} colSpan="2"> Build Details (previous) </td> </tr>
                    <TSeparatorH double={true} />
                </tbody></table>
                <BuildInfo build={props.services.data?.build?.previous} />
            </> }
            { props.services.data?.build?.next_previous && <>
                <SeparatorH top="2pt" bottom="8pt" color="gray" />
                <table style={{fontSize: "inherit", width: "100%"}}><tbody>
                    <tr> <td style={{verticalAlign: "top"}} colSpan="2"> Build Details (next previous) </td> </tr>
                    <TSeparatorH double={true} />
                </tbody></table>
                <BuildInfo build={props.services.data?.build?.next_previous} />
            </> }
        </> }
    </div>
}

const BuildInfo = (props) => {
    const tdlabel = {whiteSpace: "nowrap", paddingRight: "4pt", width: "1%"};
    const tdcontent = {whiteSpace: "nowrap", width: "99%"};
    const header = useHeader();
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
                    {props.build?.branch}
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
            { props.digest &&
                <tr>
                    <td style={tdlabel}> Digest: </td>
                    <td style={tdcontent}>
                        <span id={props.digest}>
                            {props.digest?.replace("sha256:", "")?.substring(0, 32)} ...
                            { props.digest && props.image?.digest && <>
                                { props.digest === props.image?.digest ?
                                    <b style={{color: "green"}}>&nbsp;{Char.Check}</b>
                                :   <b style={{color: "red"}}>&nbsp;{Char.X}</b> }
                            </> }
                        </span>
                        <Tooltip id={props.digest} position="bottom" size="small" text={props.digest} />
                    </td>
                </tr>
            }
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
