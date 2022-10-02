import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Global from '../Global';
import Auth from '../utils/Auth';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import Context from '../utils/Context';
import Env from '../utils/Env';
import Fetch from '../utils/Fetch';
import Image from '../utils/Image';
import Json from '../utils/Json';
import LiveTime from '../LiveTime';
import Server from '../utils/Server';
import Time from '../utils/Time';
import Type from '../utils/Type';
import Uuid from '../utils/Uuid';
import Yaml from '../utils/Yaml';

const InfoPage = () => {

    const [ header ] = useContext(Global);

    const url = Server.Url("/info");
    const [ info, setInfo ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    let [ showingAuthToken, setShowAuthToken ] = useState(false);
    useEffect(() => { Fetch.get(url, setInfo, setLoading, setError)}, []);

    function initiateAppReload() {
        const url = Server.Url("/reloadlambda", false);
        Fetch.get(url);
    }

    const InfoBox = ({title, children}) => {
        return <>
            <div className="container">
                <b>{title}</b>
                <ul className="top-level-list">
                    <div className="info boxstyle" style={{paddingLeft:"8pt",paddingTop:"6pt",paddingBottom:"8pt"}}>
                        {children}
                    </div>
                </ul>
            </div>
        </>
    }

    const InfoRow = ({name, value, monospace = false, copy = true, size = "4", pypi = null, github = null, python = false, chalice = null, check = false, link = null, optional = false}) => {
        let nameStyle = {
            fontSize: "11pt",
            fontFamily: "inherit",
            fontWeight: "normal",
            padding: "0px",
            align: "left"
        };
        let valueStyle = {
            fontSize: "11pt",
            fontFamily: monospace ? "monospace" : "inherit",
            fontWeight: "bold",
            wordWrap: "break-word",
            cursor: copy ? "copy" : "inherit",
            align: "left",
        };
        let valueOnClick = copy ? {
            onClick: () => Clipboard.Copy(name)
            
        } : {};
        let checkElement = check ?
            <span>
                &nbsp;<b style={{fontSize:"13pt",color:"green"}}>&#x2713;</b>
            </span> : <span/>
        const pypiElement = pypi ?
            <span>
                <a target="_blank" rel="noreferrer" href={"https://pypi.org/project/" + name + "/" + value + "/"}>
                    <img alt="pypi" src={Image.PyPi()} height="21" />
                </a>&nbsp;</span> : <span/>
        const githubElement = github ?
            <span>
            <a target="_blank" rel="noreferrer" href={"https://github.com/" + github + "/" + (name === "dcicutils" ? "utils" : name) + "/releases/tag/" + (name !== "chalice" ? "v" : "")  + value}>
                <img alt="github" src={Image.GitHub()} height="15" />
            </a>&nbsp;</span> : <span/>
        const pythonElement = python ?
            <span>
                <a target="_blank" rel="noreferrer" href={"https://docs.python.org/release/" + value + "/"}>
                    <img alt="python" src={Image.Python()} height="19" />
            </a>&nbsp;</span> : <span/>
        const chaliceElement = false /*chalice*/ ?
            <span>
                <a target="_blank" rel="noreferrer" href={"https://pypi.org/project/" + name + "/" + value + "/"}>
                    <img alt="chalice" src="https://www.gliffy.com/sites/default/files/image/2020-06/AWS-Lambda_Lambda-Function_dark-bg_0.png" height="14" />
                </a>&nbsp;</span> : <span/>
        return <>
            <div style={{marginTop:"1px"}}>
                { !optional || value ? (
                    <div className="row">
                        <div className={"col-sm-" + size}>
                            <div style={nameStyle}>
                                {name}:
                            </div>
                        </div>
                        <div id={name} className="col-sm-8" style={valueStyle} align="left" {...valueOnClick}>
                            {pypiElement}
                            {githubElement}
                            {pythonElement}
                            {chaliceElement}
                            { link && value ? (<span>
                                <Link to={link}>{value}</Link>
                            </span>):(<span>
                                { Type.IsNonEmptyObject(value) ? <>
                                    {value}
                                </>:<>
                                    {value || <span>&#x2205;</span>}
                                </>}
                            </span>)}
                            {checkElement}
                        </div>
                    </div>
                ):(<span/>)}
            </div>
        </>
    }

    if (error) return <>Cannot load data from Foursight API: {error}</>;
    if (loading) return <>Loading ...</>;
    return <>
        <InfoBox title="Versions">
            <InfoRow name={header.app?.package} value={header.versions?.foursight} monospace={true} copy={true} pypi={true} github={Env.IsFoursightFourfront(header) ? "4dn-dcic" : "dbmi-bgm"} size="2" />
            <InfoRow name={"foursight-core"} value={header.versions?.foursight_core} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} size="2" />
            <InfoRow name={"dcicutils"} value={header.versions?.dcicutils} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} size="2" />
            <InfoRow name={"chalice"} value={header.versions?.chalice} monospace={true} copy={true} chalice={true} size="2" pypi={true} github={"aws"} />
            <InfoRow name={"python"} value={header.versions?.python} monospace={true} copy={true} python={true} size="2" />
        </InfoBox>
        <InfoBox title="Credentials Info">
            <InfoRow name={"AWS Account Number"} value={info.app?.credentials?.aws_account_number} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS User ARN"} value={info.app?.credentials?.aws_user_arn} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS Access Key ID"} value={info.app?.credentials?.aws_access_key_id} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS Region Name"} value={info.app?.credentials?.aws_region} monospace={true} copy={true} size="2" />
            <InfoRow name={"Auth0 Client ID"} value={info.app?.credentials?.auth0_client_id} monospace={true} copy={true} size="2" />
        </InfoBox>
        <InfoBox title="Resources">
            <InfoRow name={"Foursight Server"} value={info?.server?.foursight} monospace={true} copy={true} size="2" />
            <InfoRow name={"Portal Server"} value={info?.server?.portal} monospace={true} copy={true} size="2" />
            <InfoRow name={"ElasticSearch Server"} value={info?.server?.es} monospace={true} copy={true} size="2" />
            <InfoRow name={"RDS Server"} value={info?.server?.rds} monospace={true} copy={true} size="2" />
            <InfoRow name={"SQS Server"} value={info?.server?.sqs} monospace={true} copy={true} size="2" />
        </InfoBox>
        <InfoBox title="Environment Names">
            <InfoRow name={"Environment Name"} value={Env.RegularName(Env.Current(), info)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Full)"} value={Env.FullName(Env.Current(), info)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Short)"} value={Env.ShortName(Env.Current(), info)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Public)"} value={Env.PublicName(Env.Current(), info)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Foursight)"} value={Env.FoursightName(Env.Current(), info)} monospace={true} copy={true} size="3" />
        </InfoBox>
        <InfoBox title="Bucket Names">
            <InfoRow name={"Environment Bucket Name"} value={info?.buckets?.env} monospace={true} copy={true} size="3" />
            <InfoRow name={"Foursight Bucket Name"} value={info?.buckets?.foursight} monospace={true} copy={true} size="3" />
            <InfoRow name={"Foursight Bucket Prefix"} value={info?.buckets?.foursight_prefix} monospace={true} copy={true} size="3" />
        </InfoBox>
        <InfoBox title="Environment & Bucket Names">
            <pre className="info" style={{border:"0",margin:"0",padding:"8",paddingBottom:"8",marginTop:"0"}}>
                { info.buckets?.info && info.buckets.info.map(bucket_info => {
                    return <span key={Uuid()}>{Yaml.Format(bucket_info)}{info.buckets.info.length > 1 ? <div style={{height:"1px",marginTop:"6px",marginBottom:"6px",background:"black"}}/> : <span/>}</span>
                })}
            </pre>
        </InfoBox>
        <InfoBox title="Ecosystem">
            <pre className="info" style={{border:"0",margin:"0",paddingTop:"8",paddingBottom:"8",marginTop:"0"}}>
                {Yaml.Format(info.buckets?.ecosystem)}
            </pre>
        </InfoBox>
        <InfoBox title="Authentication/Authorization Info">
            <InfoRow name={"Email"} value={Auth.Token()?.user} monospace={true} copy={true} check={Auth.Token()?.user_verified} link={Client.Path("/users/" + Auth.LoggedInUser(header), true)} size="2" />
            <InfoRow name={"First Name"} value={Auth.Token()?.first_name} monospace={true} copy={true} size="2" />
            <InfoRow name={"Last Name"} value={Auth.Token()?.last_name} monospace={true} copy={true} size="2" />
            <InfoRow name={"Environments"} value={Auth.Token()?.allowed_envs.join(", ")} monospace={true} copy={true} size="2" />
            <InfoRow name={"Audience"} value={Auth.Token()?.aud} monospace={true} copy={true} size="2" />
            <InfoRow name={"Issued At"} monospace={true} copy={true} size="2" value={<LiveTime.FormatDuration start={Auth.Token()?.authenticated_at} verbose={true} fallback={"just now"} suffix={"ago"} tooltip={true} prefix="datetime" />} />
            <InfoRow name={"Expires At"} monospace={true} copy={true} size="2" value={<LiveTime.FormatDuration end={Auth.Token()?.authenticated_until} verbose={true} fallback={"now"} suffix={"from now"} tooltip={true} prefix="datetime"/>} />
            <hr style={{borderTop:"1px solid darkblue",marginTop:"8",marginBottom:"8"}}/>
                { showingAuthToken ? (<>
                    <small onClick={() => setShowAuthToken(false)} style={{cursor:"pointer",color:"darkblue"}}><b><u>AuthToken</u>&nbsp;&#x2193;</b></small>
                    <pre style={{filter:"brightness(1.1)",background:"inherit",color:"darkblue",fontWeight:"bold",marginTop:"6pt"}}>
                        <span style={{fontSize:"0",opacity:"0"}} id={"authtoken"}>{Json.Str(Auth.Token())}</span>
                        <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken")} style={{float:"right",height:"20px",cursor:"copy"}} />
                        {Yaml.Format(Auth.Token())}
                    </pre>
                </>):(<>
                    <small onClick={() => setShowAuthToken(true)} style={{cursor:"pointer",color:"darkblue"}}><b><u>AuthToken</u>&nbsp;&#x2191;</b></small>
                    <br />
                </>)}
        </InfoBox>
        <InfoBox title="Miscellany">
            <InfoRow name={"App Deployed At"} value={Server.IsLocal() ? "running locally" + (Context.IsLocalCrossOrigin() ? " (cross-origin)" : "") : header.app?.deployed + Time.FormatDuration(header.app?.deployed, new Date(), true, "just now", "|", "ago")} monospace={true} copy={true} optional={true} size="2" />
            <InfoRow name={"App Launched At"} value={header.app?.launched + Time.FormatDuration(header.app?.launched, new Date(), true, "just now", "|", "ago")} monospace={true} size="2" />
            <InfoRow name={"Page Loaded At"} value={info.page?.loaded + Time.FormatDuration(info.page?.loaded, new Date(), true, "just now", "|", "ago")} monospace={true} size="2" />
            <InfoRow name={"Package"} value={header.app?.package} monospace={true} size="2" />
            <InfoRow name={"Stage"} value={header.app?.stage} monospace={true} size="2" />
            <InfoRow name={"Environment"} value={Env.Current()} monospace={true} size="2" />
            <InfoRow name={"Domain"} value={header.app?.domain} monospace={true} size="2" />
            <InfoRow name={"Context"} value={header.app?.context} monospace={true} size="2" />
            <InfoRow name={"Path"} value={info.page?.path} monospace={true} size="2" />
            <InfoRow name={"Endpoint"} value={info.page?.endpoint} monospace={true} size="2" />
            <InfoRow name={"Client (React UI)"} value={Client.BaseUrl()} monospace={true} size="2" />
            <InfoRow name={"Server (React API)"} value={Server.BaseUrl()} monospace={true} size="2" />
        </InfoBox>
        <InfoBox title={`GAC: ${info.gac?.name}`}>
            { info.gac?.values ? (<span>
                { Object.keys(info.gac?.values).map((key) => {
                    return <InfoRow key={key} name={key} value={info.gac.values[key]} monospace={true} copy={true} />
                })}
            </span>):(<span/>)}
        </InfoBox>
        <InfoBox title="Environment Variables">
            { info.environ ? (<span>
                { Object.keys(info.environ).map((key) => {
                    return <InfoRow key={key} name={key} value={info.environ[key]} monospace={true} copy={true} />
                })}
            </span>):(<span/>)}
        </InfoBox>
    </>
};

export default InfoPage;
