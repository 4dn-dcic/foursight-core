import { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import GlobalContext from "./GlobalContext";
import { LoginAndValidEnvRequired } from "./LoginUtils";
import { CopyToClipboard } from "./Utils";
import { fetchData } from './FetchUtils';
import * as API from "./API";
import * as URL from "./URL";
import uuid from 'react-uuid';
let YAML = require('json-to-pretty-yaml');

const Info = () => {

    const [ header ] = useContext(GlobalContext);

    const url = API.Url("/info", true);
    const [ info, setInfo ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    useEffect(() => { fetchData(url, setInfo, setLoading, setError)}, []);

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

    const InfoRow = ({name, value, monospace = false, copy = true, pypi = null, github = null, python = false, check = false, link = null, optional = false}) => {
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
            <a target="_blank" href={"https://github.com/" + github + "/" + (name == "dcicutils" ? "utils" : name) + "/releases/tag/v" + value}>
                <img src="https://git-scm.com/images/logos/downloads/Git-Logo-1788C.png" height="15" />
            </a>&nbsp;</span> : <span/>
        const pythonElement = python ?
            <span>
                <a target="_blank" href={"https://docs.python.org/release/" + value + "/"}>
                    <img src="https://logos-download.com/wp-content/uploads/2016/10/Python_logo_wordmark.png" height="19" />
            </a>&nbsp;</span> : <span/>
        return <>
            <div style={{marginTop:"1px"}}>
                { !optional || value ? (
                    <div className="row">
                        <div className="col-sm-4">
                            <div style={nameStyle}>
                                {name}:
                            </div>
                        </div>
                        <div id={name} className="col-sm-8" style={valueStyle} align="left" {...valueOnClick}>
                            {pypiElement}
                            {githubElement}
                            {pythonElement}
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
            <InfoRow name={"dcicutils"} value={header.versions?.dcicutils} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} />
            <InfoRow name={"foursight-core"} value={header.versions?.foursight_core} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} />
            <InfoRow name={header.app?.package} value={header.versions?.foursight} monospace={true} copy={true} pypi={true} github={"dbmi-bgm"} />
            <InfoRow name={"python"} value={header.versions?.python} monospace={true} copy={true} python={true} />
        </InfoBox>
        <InfoBox title="Credentials Info">
            <InfoRow name={"AWS Account Number"} value={header.app?.credentials?.aws_account_number} monospace={true} copy={true} />
            <InfoRow name={"AWS User ARN"} value={header.app?.credentials?.aws_user_arn} monospace={true} copy={true} />
            <InfoRow name={"AWS Access Key ID"} value={header.app?.credentials?.aws_access_key_id} monospace={true} copy={true} />
            <InfoRow name={"AWS Region Name"} value={header.app?.credentials?.aws_region} monospace={true} copy={true} />
            <InfoRow name={"Auth0 Client ID"} value={header.app?.credentials?.auth0_client_id} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Resources">
            <InfoRow name={"Foursight Server"} value={header?.server?.foursight} monospace={true} copy={true} />
            <InfoRow name={"Portal Server"} value={header?.server?.portal} monospace={true} copy={true} />
            <InfoRow name={"ElasticSearch Server"} value={header?.server?.es} monospace={true} copy={true} />
            <InfoRow name={"RDS Server"} value={header?.server?.rds} monospace={true} copy={true} />
            <InfoRow name={"SQS Server"} value={header?.server?.sqs} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Environment Names">
            <InfoRow name={"Environment Name"} value={header?.env?.name} monospace={true} copy={true} />
            <InfoRow name={"Environment Name (Full)"} value={header?.env?.full_name} monospace={true} copy={true} />
            <InfoRow name={"Environment Name (Short)"} value={header?.env?.short_name} monospace={true} copy={true} />
            <InfoRow name={"Environment Name (Public)"} value={header?.env?.public_name} monospace={true} copy={true} />
            <InfoRow name={"Environment Name (Foursight)"} value={header?.env?.foursight_name} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Bucket Names">
            <InfoRow name={"Environment Bucket Name"} value={header?.buckets?.env} monospace={true} copy={true} />
            <InfoRow name={"Foursight Bucket Name"} value={header?.buckets?.foursight} monospace={true} copy={true} />
            <InfoRow name={"Foursight Bucket Prefix"} value={header?.buckets?.foursight_prefix} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Environment & Bucket Names">
            <pre className="info" style={{border:"0",margin:"0",padding:"8",paddingBottom:"8",marginTop:"0"}}>
                { header.buckets?.info && header.buckets.info.map(bucket_info => {
                    return <span key={uuid()}>{YAML.stringify(bucket_info)}{header.buckets.info.length > 1 ? <div style={{height:"1px",marginTop:"6px",marginBottom:"6px",background:"black"}}/> : <span/>}</span>
                })}
            </pre>
        </InfoBox>
        <InfoBox title="Ecosystem">
            <pre className="info" style={{border:"0",margin:"0",paddingTop:"8",paddingBottom:"8",marginTop:"0"}}>
                {YAML.stringify(header.buckets?.ecosystem)}
            </pre>
        </InfoBox>
        <InfoBox title="Login Auth0 Info">
            <InfoRow name={"Email"} value={header.login?.jwt?.email} monospace={true} copy={true} check={header.login?.jwt?.email_verified} link={URL.Url("/users/" + header.login?.jwt?.email, true)} />
            <InfoRow name={"Issuer"} value={header.login?.jwt?.iss} monospace={true} copy={true} />
            <InfoRow name={"Subject"} value={header.login?.jwt?.sub} monospace={true} copy={true} />
            <InfoRow name={"Audience"} value={header.login?.jwt?.aud} monospace={true} copy={true} />
            <InfoRow name={"Issued At"} value={header.login?.jwt?.iat} monospace={true} copy={true} />
            <InfoRow name={"Expires At"} value={header.login?.jwt?.exp} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Miscellany">
            <InfoRow name={"App Deployed At"} value={header.app?.deployed} monospace={true} copy={true} optional={true} />
            <InfoRow name={"App Launched At"} value={header.app?.launched} monospace={true}/>
            <InfoRow name={"Page Loaded At"} value={header.app?.launched} monospace={true}/>
            <InfoRow name={"Package"} value={header.app?.package} monospace={true}/>
            <InfoRow name={"Stage"} value={header.app?.stage} monospace={true}/>
            <InfoRow name={"Environment"} value={header.app?.env} monospace={true}/>
            <InfoRow name={"Domain"} value={header.page?.domain} monospace={true}/>
            <InfoRow name={"Context"} value={header.page?.context} monospace={true}/>
            <InfoRow name={"Path"} value={header.page?.path} monospace={true}/>
            <InfoRow name={"Endpoint"} value={header.page?.endpoint} monospace={true}/>
        </InfoBox>
        <InfoBox title="GAC">
            { info.gac?.values ? (<span>
                { Object.keys(info.gac?.values).map((key) => {
                    return <InfoRow key={key} name={key} value={info.gac.values[key]} monospace={true} copy={true} />
                })}
            </span>):(<span/>)}
        </InfoBox>
        <InfoBox title="Environment Variables">
            { info.environ ? (<span>
                { Object.keys(info.environ).map((key) => {
                    return <InfoRow key={key} name={key} value={info.gac.values[key]} monospace={true} copy={true} />
                })}
            </span>):(<span/>)}
        </InfoBox>
    </LoginAndValidEnvRequired>
};

export default Info;
