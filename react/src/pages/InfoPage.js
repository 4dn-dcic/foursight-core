import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "../GlobalContext";
import { GetLoginInfo, LoginAndValidEnvRequired } from "../utils/LoginUtils";
import { CopyToClipboard } from "../utils/Utils";
import { fetchData } from '../utils/FetchUtils';
import * as API from "../utils/API";
import * as URL from "../utils/URL";
import { FormatDateTime, Duration } from "../utils/Utils";
import uuid from 'react-uuid';
let YAML = require('json-to-pretty-yaml');

const InfoPage = () => {

    const [ header ] = useContext(GlobalContext);

    const url = API.Url("/info", true);
    const [ info, setInfo ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    useEffect(() => { fetchData(url, setInfo, setLoading, setError)}, []);
    //
    // TODO: Set this within /header API call.
    //
    let isFoursightFourfront = header.app?.package != "foursight-cgap";
    isFoursightFourfront =true

        console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
        console.log(Duration(header.app?.launched));

    const InfoBox = ({title, children}) => {
        return <>
            <div className="container">
                <b>{title}</b>
                <ul className="top-level-list">
                    <div className="info boxstyle" style={{paddingLeft:"8pt",paddingTop:"6pt",paddingBottom:"8pt",paddingBottom:"6pt"}}>
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
            onClick: () => CopyToClipboard(name)
            
        } : {};
        let checkElement = check ?
            <span>
                &nbsp;&nbsp;<b style={{fontSize:"13pt",color:"green"}}>&#x2713;</b>
            </span> : <span/>
        const pypiElement = pypi ?
            <span>
                <a target="_blank" href={"https://pypi.org/project/" + name + "/" + value + "/"}>
                    <img src="https://cdn-images-1.medium.com/max/1064/1*8Zh-mzLnVMDsbvXdKsU4lw.png" height="21" />
                </a>&nbsp;</span> : <span/>
        const githubElement = github ?
            <span>
            <a target="_blank" href={"https://github.com/" + github + "/" + (name == "dcicutils" ? "utils" : name) + "/releases/tag/" + (name != "chalice" ? "v" : "")  + value}>
                <img src="https://git-scm.com/images/logos/downloads/Git-Logo-1788C.png" height="15" />
            </a>&nbsp;</span> : <span/>
        const pythonElement = python ?
            <span>
                <a target="_blank" href={"https://docs.python.org/release/" + value + "/"}>
                    <img src="https://logos-download.com/wp-content/uploads/2016/10/Python_logo_wordmark.png" height="19" />
            </a>&nbsp;</span> : <span/>
        const chaliceElement = false /*chalice*/ ?
            <span>
                <a target="_blank" href={"https://pypi.org/project/" + name + "/" + value + "/"}>
                    <img src="https://www.gliffy.com/sites/default/files/image/2020-06/AWS-Lambda_Lambda-Function_dark-bg_0.png" height="14" />
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
                                {value || <span>&#x2205;</span>}
                            </span>)}
                            {checkElement}
                        </div>
                    </div>
                ):(<span/>)}
            </div>
        </>
    }

    if (header.error) return <>Cannot load Foursight.</>;
    if (header.loading) return <>Loading ...</>;
    return <LoginAndValidEnvRequired>
        <InfoBox title="Versions">
            <InfoRow name={header.app?.package} value={header.versions?.foursight} monospace={true} copy={true} pypi={true} github={isFoursightFourfront ? "4dn-dcic" : "dbmi-bgm"} size="2" />
            <InfoRow name={"foursight-core"} value={header.versions?.foursight_core} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} size="2" />
            <InfoRow name={"dcicutils"} value={header.versions?.dcicutils} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} size="2" />
            <InfoRow name={"chalice"} value={header.versions?.chalice} monospace={true} copy={true} chalice={true} size="2" pypi={true} github={"aws"} />
            <InfoRow name={"python"} value={header.versions?.python} monospace={true} copy={true} python={true} size="2" />
        </InfoBox>
        <InfoBox title="Credentials Info">
            <InfoRow name={"AWS Account Number"} value={header.app?.credentials?.aws_account_number} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS User ARN"} value={header.app?.credentials?.aws_user_arn} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS Access Key ID"} value={header.app?.credentials?.aws_access_key_id} monospace={true} copy={true} size="2" />
            <InfoRow name={"AWS Region Name"} value={header.app?.credentials?.aws_region} monospace={true} copy={true} size="2" />
            <InfoRow name={"Auth0 Client ID"} value={header.app?.credentials?.auth0_client_id} monospace={true} copy={true} size="2" />
        </InfoBox>
        <InfoBox title="Resources">
            <InfoRow name={"Foursight Server"} value={info?.server?.foursight} monospace={true} copy={true} size="2" />
            <InfoRow name={"Portal Server"} value={info?.server?.portal} monospace={true} copy={true} size="2" />
            <InfoRow name={"ElasticSearch Server"} value={info?.server?.es} monospace={true} copy={true} size="2" />
            <InfoRow name={"RDS Server"} value={info?.server?.rds} monospace={true} copy={true} size="2" />
            <InfoRow name={"SQS Server"} value={info?.server?.sqs} monospace={true} copy={true} size="2" />
        </InfoBox>
        <InfoBox title="Environment Names">
            <InfoRow name={"Environment Name"} value={header?.env?.name} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Full)"} value={header?.env?.full_name} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Short)"} value={header?.env?.short_name} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Public)"} value={header?.env?.public_name} monospace={true} copy={true} size="3" />
            <InfoRow name={"Environment Name (Foursight)"} value={header?.env?.foursight_name} monospace={true} copy={true} size="3" />
        </InfoBox>
        <InfoBox title="Bucket Names">
            <InfoRow name={"Environment Bucket Name"} value={info?.buckets?.env} monospace={true} copy={true} size="3" />
            <InfoRow name={"Foursight Bucket Name"} value={info?.buckets?.foursight} monospace={true} copy={true} size="3" />
            <InfoRow name={"Foursight Bucket Prefix"} value={info?.buckets?.foursight_prefix} monospace={true} copy={true} size="3" />
        </InfoBox>
        <InfoBox title="Environment & Bucket Names">
            <pre className="info" style={{border:"0",margin:"0",padding:"8",paddingBottom:"8",marginTop:"0"}}>
                { info.buckets?.info && info.buckets.info.map(bucket_info => {
                    return <span key={uuid()}>{YAML.stringify(bucket_info)}{info.buckets.info.length > 1 ? <div style={{height:"1px",marginTop:"6px",marginBottom:"6px",background:"black"}}/> : <span/>}</span>
                })}
            </pre>
        </InfoBox>
        <InfoBox title="Ecosystem">
            <pre className="info" style={{border:"0",margin:"0",paddingTop:"8",paddingBottom:"8",marginTop:"0"}}>
                {YAML.stringify(info.buckets?.ecosystem)}
            </pre>
        </InfoBox>
        <InfoBox title="Login Auth0 Info">
            <InfoRow name={"Email"} value={GetLoginInfo()?.email} monospace={true} copy={true} check={GetLoginInfo()?.email_verified} link={URL.Url("/users/" + GetLoginInfo()?.email, true)} size="2" />
            <InfoRow name={"Issuer"} value={GetLoginInfo()?.iss} monospace={true} copy={true} size="2" />
            <InfoRow name={"Subject"} value={GetLoginInfo()?.sub} monospace={true} copy={true} size="2" />
            <InfoRow name={"Audience"} value={GetLoginInfo()?.aud} monospace={true} copy={true} size="2" />
            <InfoRow name={"Issued At"} value={FormatDateTime(GetLoginInfo()?.iat) + Duration(GetLoginInfo()?.iat, new Date(), true, "|", "ago", "just now")} monospace={true} copy={true} size="2" />
            <InfoRow name={"Expires At"} value={FormatDateTime(GetLoginInfo()?.exp) + Duration(new Date(), GetLoginInfo()?.exp, true, "|", "from now", "now")} monospace={true} copy={true} size="2" />
        </InfoBox>
        <InfoBox title="Miscellany">
            <InfoRow name={"App Deployed At"} value={header.app?.deployed + Duration(header.app?.deployed, new Date(), true, "|", "ago", "just now")} monospace={true} copy={true} optional={true} size="2" />
            <InfoRow name={"App Launched At"} value={header.app?.launched + Duration(header.app?.launched, new Date(), true, "|", "ago", "just now")} monospace={true} size="2" />
            <InfoRow name={"Page Loaded At"} value={info.page?.loaded + Duration(header.app?.loaded, new Date(), true, "|", "ago", "just now")} monospace={true} size="2" />
            <InfoRow name={"Package"} value={header.app?.package} monospace={true} size="2" />
            <InfoRow name={"Stage"} value={header.app?.stage} monospace={true} size="2" />
            <InfoRow name={"Environment"} value={header.app?.env} monospace={true} size="2" />
            <InfoRow name={"Domain"} value={header.app?.domain} monospace={true} size="2" />
            <InfoRow name={"Context"} value={header.page?.context} monospace={true} size="2" />
            <InfoRow name={"Path"} value={info.page?.path} monospace={true} size="2" />
            <InfoRow name={"Endpoint"} value={info.page?.endpoint} monospace={true} size="2" />
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
    </LoginAndValidEnvRequired>
};

export default InfoPage;
