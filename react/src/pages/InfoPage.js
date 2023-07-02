import { useState } from 'react';
import { Link } from 'react-router-dom';
import Uuid from 'react-uuid';
import { StandardSpinner } from '../Spinners';
import useHeader from '../hooks/Header';
import AccountsComponent from './AccountsComponent';
import Auth from '../utils/Auth';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import Char from '../utils/Char';
import Context from '../utils/Context';
import DateTime from '../utils/DateTime';
import Duration from '../utils/Duration';
import Env from '../utils/Env';
import useFetch from '../hooks/Fetch';
import useFetchFunction from '../hooks/FetchFunction';
import { FetchErrorBox } from '../Components';
import Image from '../utils/Image';
import Json from '../utils/Json';
import LiveTime from '../LiveTime';
import Server from '../utils/Server';
import Time from '../utils/Time';
import Tooltip from '../components/Tooltip';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

const InfoBox = ({title, show = true, info, children}) => {
    const [ showing, setShowing ] = useState(show);
    return <>
        <div className="container">
            { showing ? <>
                <b onClick={() => setShowing(false)} style={{cursor:"pointer"}}>{title}</b> &nbsp;<span onClick={() => setShowing(false)} style={{cursor:"pointer"}}>{Char.DownArrow}</span>
                { title === "Versions" && <b id="tooltip-info-refresh" style={{float:"right",cursor:"pointer"}} onClick={info.refresh}>{Char.Refresh}&nbsp;</b> }
                 <Tooltip id="tooltip-info-refresh" position="bottom" size="small" text="Click to refresh." />
                <ul className="top-level-list">
                    <div className="box" style={{paddingLeft:"8pt",paddingTop:"6pt",paddingBottom:"8pt"}}>
                        {children}
                    </div>
                </ul>
            </>:<>
                <b onClick={() => setShowing(true)} style={{cursor:"pointer"}}>{title}</b> &nbsp;<span onClick={() => setShowing(true)} style={{cursor:"pointer"}}>{Char.UpArrow}</span>
                <div className="box">
                    Click <span onClick={() => setShowing(true)} style={{cursor:"pointer"}}><b>here</b></span> to <span onClick={() => setShowing(true)} style={{cursor:"pointer"}}>show</span>.
                </div>
            </>}
        </div>
    </>
}

const InfoRow = ({name, value, monospace = false, copy = true, size = "4",
                  pypi = null, github = null, elasticsearch = false, redis = false, python = false, chalice = null,
                  check = false, nocheck = false, link = null, optional = false,
                  portalCertificate = false, portalAccessKey = false, apiCache = false}) => {
    function removeMinorVersion(version) {
        let components = version?.split(".")
        return (components?.length >= 2) ? components[0] + "." + components[1] : version;
    }
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
            &nbsp;<b style={{fontSize:"13pt",color:"green"}}>{Char.Check}</b>
        </span> : <span/>
    let nocheckElement = nocheck ?
        <span>
            &nbsp;<b style={{fontSize:"13pt",color:"red"}}>{Char.X}</b>
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
    const elasticsearchElement = elasticsearch ?
        <span>
        <a target="_blank" rel="noreferrer" href={`https://www.elastic.co/guide/en/elasticsearch/reference/${removeMinorVersion(value)}/release-notes-${value}.html`} style={{marginLeft:"-2px"}}>
            <img alt="github" src={Image.ElasticsearchLogo()} height="18" />
        </a>&nbsp;</span> : <span/>
    const redisElement = redis ?
        <span>
        <a target="_blank" rel="noreferrer" href={`https://raw.githubusercontent.com/redis/redis/${value}/00-RELEASENOTES`} style={{marginLeft:"-2px"}}>
            <img alt="github" src="https://1000logos.net/wp-content/uploads/2020/08/Redis-Logo-1280x800.png" height="21" style={{marginLeft: "3pt"}}/>
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
                        {elasticsearchElement}
                        {redisElement}
                        {pythonElement}
                        {chaliceElement}
                        { link && value ? (<span>
                            <Link to={link}>{value}</Link>
                        </span>):(<span>
                            { Type.IsNonEmptyObject(value) ? <>
                                {value}
                            </>:<>
                                {value || <span>{Char.EmptySet}</span>}
                            </>}
                            { portalAccessKey && <>
                                &nbsp;{Char.RightArrow}&nbsp;<Link to={Client.Path("/portal_access_key")}>View Details</Link>
                            </> }
                            { portalCertificate && <>
                                &nbsp;{Char.RightArrow}&nbsp;<Link to={Client.Path("/certificates")}>View Certificate</Link>
                            </> }
                            { apiCache && <>
                                &nbsp;{Char.RightArrow}&nbsp;<Link to={Client.Path("/apicache")}>View API Cache</Link>
                            </> }
                        </span>)}
                        {checkElement}
                        {nocheckElement}
                    </div>
                </div>
            ):(<span/>)}
        </div>
    </>
}

const InfoPage = () => {

    const header = useHeader();
    const info = useFetch("/info");
    const [ showingAuthToken, setShowAuthToken ] = useState(false);
    const [ showingAccounts, setShowingAccounts ] = useState(false);
    const [ reloadingApp, setReloadingApp ] = useState(false);
    const accessKey = useFetch("/portal_access_key");
    const fetch = useFetchFunction();

    function initiateAppReload() {
        setReloadingApp(true);
        fetch("/__reloadlambda__", { onDone: () => setReloadingApp(false) });
    }

    function clearCache() {
        fetch(Server.Url("/__functioncacheclear__", false));
    }

    if (info.error) return <FetchErrorBox error={info.error} message="Error loading info from Foursight API" />
    return <div className="container">
        <InfoBox info={info} title="Versions">
            <InfoRow name={header.app?.package} value={header.versions?.foursight} monospace={true} copy={true} pypi={true} github={Env.IsFoursightFourfront(header) ? "4dn-dcic" : "dbmi-bgm"} size="2" />
            <InfoRow name={"foursight-core"} value={header.versions?.foursight_core} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} size="2" />
            <InfoRow name={"dcicutils"} value={header.versions?.dcicutils} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} size="2" />
            <InfoRow name={"tibanna"} value={header.versions?.tibanna} monospace={true} copy={true} size="2" pypi={true} />
            <InfoRow name={"tibanna-ff"} value={header.versions?.tibanna_ff} monospace={true} copy={true} size="2" pypi={true} />
            <InfoRow name={"chalice"} value={header.versions?.chalice} monospace={true} copy={true} chalice={true} size="2" pypi={true} github={"aws"} />
            <InfoRow name={"python"} value={header.versions?.python} monospace={true} copy={true} python={true} size="2" />
            <InfoRow name={"elasticsearch-server"} value={header.versions?.elasticsearch_server || info.data?.versions?.elasticsearch_server} monospace={true} copy={true} size="2" elasticsearch={true} />
            <InfoRow name={"elasticsearch"} value={header.versions?.elasticsearch} monospace={true} copy={true} size="2" pypi={true} />
            <InfoRow name={"elasticsearch-dsl"} value={header.versions?.elasticsearch_dsl} monospace={true} copy={true} size="2" pypi={true} />
           { info.data?.versions?.redis_server && <>
               <InfoRow name={"redis-server"} value={header.versions?.redis_server || info.data?.versions?.redis_server} monospace={true} copy={true} size="2" redis={true} />
               <InfoRow name={"redis"} value={header.versions?.redis} monospace={true} copy={true} size="2" pypi={true} />
           </>}
        </InfoBox>
        <InfoBox info={info} title="Credentials Info">
            <InfoRow name={"AWS Account Number"} value={info.get("app.credentials.aws_account_number")} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS Region Name"} value={info.get("app.credentials.aws_region")} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS User ARN"} value={info.get("app.credentials.aws_user_arn")} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS Access Key ID"} value={info.get("app.credentials.aws_access_key_id")} monospace={true} copy={true} size="2" />
            { info.get("environ.S3_AWS_ACCESS_KEY_ID") &&
                <InfoRow name={"AWS S3 Access Key ID"} value={info.get("environ.S3_AWS_ACCESS_KEY_ID")} monospace={true} copy={true} size="2" />
            }
            <InfoRow name={"Portal Access Key"} value={accessKey.get("key")} monospace={true} copy={true} size="2" portalAccessKey={true} />
            <InfoRow name={"Auth0 Client ID"} value={info.get("app.credentials.auth0_client_id")} monospace={true} copy={true} size="2" />
        </InfoBox>
        <InfoBox info={info} title="Resources">
            <InfoRow name={"Foursight Server"} value={info.get("server.foursight")} monospace={true} copy={true} size="2" />
            <InfoRow name={"Foursight"} value={header.resources?.foursight} monospace={true} copy={true} size="2" />
            <InfoRow name={"Portal"} value={header.resources?.portal} monospace={true} copy={true} size="2" portalCertificate={true} />
            <InfoRow name={"ElasticSearch"} value={`${header.resources?.es} (${header.resources?.es_cluster})`} monospace={true} copy={true} size="2" />
            <InfoRow name={"RDS"} value={header.resources?.rds} monospace={true} copy={true} size="2" />
            <InfoRow name={"SQS"} value={header.resources?.sqs} monospace={true} copy={true} size="2" />
            { header.resources?.redis_running &&
                <InfoRow name={"Redis"} value={header.resources?.redis} nocheck={!header.resources?.redis_running} check={header.resources?.redis_running} monospace={true} copy={true} size="2" />
            }
        </InfoBox>
        <InfoBox info={info} title="Authentication/Authorization Info" show={true}>
            <InfoRow name={"Email"} value={Auth.Token()?.user} monospace={true} copy={true} check={Auth.Token()?.user_verified} link={Client.Path("/users/" + Auth.LoggedInUser(header), true)} size="2" />
            <InfoRow name={"First Name"} value={Auth.Token()?.first_name} monospace={true} copy={true} size="2" />
            <InfoRow name={"Last Name"} value={Auth.Token()?.last_name} monospace={true} copy={true} size="2" />
            <InfoRow name={"Environments"} value={Auth.Token()?.allowed_envs.join(", ")} monospace={true} copy={true} size="2" />
            <InfoRow name={"Audience"} value={Auth.Token()?.aud} monospace={true} copy={true} size="2" />
            <InfoRow name={"Issued At"} monospace={true} copy={true} size="2" value={<Duration.Live start={Auth.Token()?.authenticated_at} verbose={true} fallback={"just now"} suffix={"ago"} tooltip={true} prefix="datetime" />} />
            <InfoRow name={"Expires At"} monospace={true} copy={true} size="2" value={<Duration.Live end={Auth.Token()?.authenticated_until} verbose={true} fallback={"now"} suffix={"from now"} tooltip={true} prefix="datetime"/>} />
            <InfoRow name={"Using Redis"} monospace={true} size="2" value={header.resources?.redis_running ? "Yes" : "No"} />
            <hr style={{borderTop:"1px solid darkblue",marginTop:"8",marginBottom:"8"}}/>
                { showingAuthToken ? (<>
                    <small onClick={() => setShowAuthToken(false)} style={{cursor:"pointer",color:"inherit"}}><b><u>AuthToken</u>&nbsp;{Char.DownArrow}</b></small>
                    <pre style={{filter:"brightness(1.05)",background:"inherit",color:"inherit",fontWeight:"bold",marginTop:"6pt"}}>
                        <span style={{fontSize:"0",opacity:"0"}} id={"authtoken"}>{Json.Str(Auth.Token())}</span>
                        <img src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("authtoken")} style={{float:"right",height:"20px",cursor:"copy"}} />
                        {Yaml.Format(Auth.Token())}
                    </pre>
                </>):(<>
                    <small onClick={() => setShowAuthToken(true)} style={{cursor:"pointer",color:"darkblue"}}><b><u>AuthToken</u>&nbsp;{Char.UpArrow}</b></small>
                    <br />
                </>)}
        </InfoBox>
        <InfoBox info={info} title="Environment Names">
            <InfoRow name={"Environment Name"} value={Env.RegularName(Env.Current(), header)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Full)"} value={Env.FullName(Env.Current(), header)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Short)"} value={Env.ShortName(Env.Current(), header)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Public)"} value={Env.PublicName(Env.Current(), header)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Foursight)"} value={Env.FoursightName(Env.Current(), header)} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Preferred)"} value={Env.PreferredName(Env.Current(header), header)} monospace={true} copy={true} size="3" />
        </InfoBox>
        <InfoBox info={info} title="Bucket Names">
            <InfoRow name={"Global Environment Bucket"} value={info.get("buckets.env")} monospace={true} copy={true} size="3" />
            <InfoRow name={"Foursight Bucket Name"} value={info.get("buckets.foursight")} monospace={true} copy={true} size="3" />
            <InfoRow name={"Foursight Bucket Prefix"} value={info.get("buckets.foursight_prefix")} monospace={true} copy={true} size="3" />
        </InfoBox>
        <InfoBox info={info} title="Environment & Bucket Names">
            <pre className="box" style={{border:"0",margin:"0",padding:"8",paddingBottom:"8",marginTop:"0"}}>
                <span key={Uuid()}>{Yaml.Format(info.get("buckets.info"))}{info.get("buckets.info")?.length > 1 ? <div style={{height:"1px",marginTop:"6px",marginBottom:"6px",background:"black"}}/> : <span/>}</span>
            </pre>
        </InfoBox>
        <InfoBox info={info} title="Ecosystem" show={false}>
            <pre className="box" style={{border:"0",margin:"0",paddingTop:"8",paddingBottom:"8",marginTop:"0"}}>
                {Yaml.Format(info.get("buckets.ecosystem"))}
            </pre>
        </InfoBox>
        { info.get("environ.AWS_LAMBDA_LOG_GROUP_NAME") && info.get("environ.AWS_LAMBDA_LOG_STREAM_NAME") && <>
            <InfoBox info={info} title="Logs">
                <InfoRow name={"Log Group"} value={info.get("environ.AWS_LAMBDA_LOG_GROUP_NAME")} monospace={true} size="2" />
                <InfoRow name={"Log Stream"} value={info.get("environ.AWS_LAMBDA_LOG_STREAM_NAME")} monospace={true} size="2" />
            </InfoBox>
        </>}
        { info.get("app.lambda") &&
            <InfoBox info={info} title="Lambda" show={false}>
                <InfoRow name={"Name"} value={info.get("app.lambda.lambda_name")} monospace={true} size="2" />
                <InfoRow name={"Function"} value={info.get("app.lambda.lambda_function_name")} monospace={true} size="2" />
                <InfoRow name={"ARN"} value={info.get("app.lambda.lambda_function_arn")} monospace={true} size="2" />
                <InfoRow name={"S3 Location"} value={info.get("app.lambda.lambda_code_s3_bucket") + "/" + info.get("app.lambda.lambda_code_s3_bucket_key")} monospace={true} size="2" />
                <InfoRow name={"Size"} value={info.get("app.lambda.lambda_code_size")} monospace={true} size="2" />
                <InfoRow name={"Modified"} value={DateTime.Format(info.get("app.lambda.lambda_modified"))} monospace={true} size="2" />
                <InfoRow name={"Role"} value={info.get("app.lambda.lambda_role")} monospace={true} size="2" />
            </InfoBox>
        }
        <InfoBox info={info} title="Miscellany">
            { reloadingApp ? <>
                <div id="tooltip-info-reloading" style={{float:"right"}}><StandardSpinner condition={reloadingApp} label={""} color={"darkblue"} /></div>
                <Tooltip id="tooltip-info-reloading" position="bottom" size="small" text="Reloading the Foursight app." />
            </>:<>
                <b onClick={() => initiateAppReload()} id="tooltip-info-reload" style={{float:"right",cursor:"pointer"}}>{Char.Refresh}</b>
                <Tooltip id="tooltip-info-reload" position="bottom" size="small" text="Click here to reload the Foursight app." />
            </>}
            <div id="tooltip-info-clear" style={{float:"right",marginTop:"-1px",marginRight:"4pt",cursor:"pointer"}}>&nbsp;&nbsp;<img alt="Clear Cache" src={Image.ClearCache()} height="19" onClick={clearCache}/></div>
            <Tooltip id="tooltip-info-clear" position="bottom" size="small" text="Click to clear any server-side caches." />
            <InfoRow name={"App Deployed At"} value={Server.IsLocal() ? "running locally" + (Context.IsLocalCrossOrigin() ? " (cross-origin)" : "") : DateTime.Format(header.app?.deployed) + Duration.Format(header.app?.deployed, new Date(), true, "just now", "|", "ago")} monospace={true} copy={true} optional={true} size="2" />
            <InfoRow name={"App Launched At"} value={header.app?.launched + Duration.Format(header.app?.launched, new Date(), true, "just now", "|", "ago")} monospace={true} size="2" />
            <InfoRow name={"Page Loaded At"} value={info.get("page.loaded") + Duration.Format(info.get("page.loaded"), new Date(), true, "just now", "|", "ago")} monospace={true} size="2" />
            <InfoRow name={"Package"} value={header.app?.package} monospace={true} size="2" />
            <InfoRow name={"Stage"} value={header.app?.stage} monospace={true} size="2" />
            <InfoRow name={"Environment"} value={Env.Current()} monospace={true} size="2" />
            <InfoRow name={"Domain"} value={header.app?.domain} monospace={true} size="2" />
            <InfoRow name={"Context"} value={header.app?.context} monospace={true} size="2" />
            <InfoRow name={"Path"} value={info.get("page.path")} monospace={true} size="2" />
            <InfoRow name={"Endpoint"} value={info.get("page.endpoint")} monospace={true} size="2" />
            <InfoRow name={"Client (React UI)"} value={Client.BaseUrl()} monospace={true} size="2" />
            <InfoRow name={"Server (React API)"} value={Server.BaseUrl()} monospace={true} size="2" apiCache={true} />
            <InfoRow name={"Checks File"} value={info.data?.checks?.file} monospace={true} size="2" />
            { header.app?.accounts_file &&
                <InfoRow name={"Accounts File"} value={header.app?.accounts_file} monospace={true} size="2" />
            }
        </InfoBox>
        <InfoBox info={info} title={`GAC: ${info.get("app.identity")}`} show={false}>
            { info.get("gac.values") ? (<span>
                { Object.keys(info.get("gac.values")).map((key) => {
                    return <InfoRow key={key} name={key} value={info.get("gac.values")[key]} monospace={true} copy={true} />
                })}
            </span>):(<span/>)}
        </InfoBox>
        <InfoBox info={info} title="Environment Variables" show={false}>
            { info.get("environ") ? (<span>
                { Object.keys(info.get("environ")).map((key) => {
                    return <InfoRow key={key} name={key} value={info.get("environ")[key]} monospace={true} copy={true} />
                })}
            </span>):(<span/>)}
        </InfoBox>
        { header.app?.accounts &&
            <div className="container" style={{marginTop:"4pt"}}>
                { showingAccounts ? <>
                    <AccountsComponent />
                </>:<>
                    <b onClick={() => setShowingAccounts(true)} style={{cursor:"pointer"}}>Show Accounts</b>
                    <div className="box">
                        Click <b onClick={() => setShowingAccounts(true)} style={{cursor:"pointer"}}>here</b> to <span onClick={() => setShowingAccounts(true)} style={{cursor:"pointer"}}>show</span>.
                    </div>
                </>}
            </div>
        }
    </div>
};

export default InfoPage;
