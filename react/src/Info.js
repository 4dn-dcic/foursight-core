import { useContext } from 'react';
import GlobalContext from "./GlobalContext.js";
import { LoginAndValidEnvRequired } from "./LoginUtils.js";
import { CopyToClipboard } from "./Utils";

const Info = () => {

    const [ info ] = useContext(GlobalContext);

    const InfoBox = ({title, children}) => {
        return <>
            <div className="container">
                <b>{title}</b>
                <ul className="top-level-list">
                    <div className="info boxstyle">
                    {children}
                    </div>
                </ul>
            </div>
        </>
    }

    const InfoRow = ({name, value, monospace = false, copy = true, pypi = null, github = null, python = false, check = false, optional = false}) => {
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
            <div style={{margin:"4px 4px 4px 4px"}}>
                { !optional || value ? (
                    <div className="row">
                        <div className="col-sm-4">
                            <div style={nameStyle}>
                                {name}
                            </div>
                        </div>
                        <div id={name} className="col-sm-8" style={valueStyle} align="left" {...valueOnClick}>
                            {pypiElement}
                            {githubElement}
                            {pythonElement}
                            {value}
                            {checkElement}
                        </div>
                    </div>
                ):(<span/>)}
            </div>
        </>
    }

    if (info.error) return <>Cannot load Foursight.</>;
    if (info.loading) return <>Loading ...</>;
    return <LoginAndValidEnvRequired>
        <InfoBox title="Versions">
            <InfoRow name={"dcicutils"} value={info.versions?.dcicutils} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} />
            <InfoRow name={"foursight-core"} value={info.versions?.foursight_core} monospace={true} copy={true} pypi={true} github={"4dn-dcic"} />
            <InfoRow name={info.app?.package} value={info.versions?.foursight} monospace={true} copy={true} pypi={true} github={"dbmi-bgm"} />
            <InfoRow name={"python"} value={info.versions?.python} monospace={true} copy={true} python={true} />
        </InfoBox>
        <InfoBox title="Credentials Info">
            <InfoRow name={"AWS Account Number"} value={info.app?.credentials?.aws_account_number} monospace={true} copy={true} />
            <InfoRow name={"AWS User ARN"} value={info.app?.credentials?.aws_user_arn} monospace={true} copy={true} />
            <InfoRow name={"AWS Access Key ID"} value={info.app?.credentials?.aws_access_key_id} monospace={true} copy={true} />
            <InfoRow name={"AWS Region Name"} value={info.app?.credentials?.aws_region} monospace={true} copy={true} />
            <InfoRow name={"Auth0 Client ID"} value={info.app?.credentials?.auth0_client_id} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Resources">
            <InfoRow name={"Foursight Server"} value={info?.server?.foursight} monospace={true} copy={true} />
            <InfoRow name={"Portal Server"} value={info?.server?.portal} monospace={true} copy={true} />
            <InfoRow name={"ElasticSearch Server"} value={info?.server?.es} monospace={true} copy={true} />
            <InfoRow name={"RDS Server"} value={info?.server?.rds} monospace={true} copy={true} />
            <InfoRow name={"SQS Server"} value={info?.server?.sqs} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Environment Names">
            <InfoRow name={"Environment Name"} value={info?.env?.name} monospace={true} copy={true} />
            <InfoRow name={"Environment Name (Full)"} value={info?.env?.full_name} monospace={true} copy={true} />
            <InfoRow name={"Environment Name (Short)"} value={info?.env?.short_name} monospace={true} copy={true} />
            <InfoRow name={"Environment Name (Public)"} value={info?.env?.public_name} monospace={true} copy={true} />
            <InfoRow name={"Environment Name (Foursight)"} value={info?.env?.inferred_name} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Bucket Names">
            <InfoRow name={"Environment Bucket Name"} value={info?.buckets?.env} monospace={true} copy={true} />
            <InfoRow name={"Foursight Bucket Name"} value={info?.buckets?.foursight} monospace={true} copy={true} />
            <InfoRow name={"Foursight Bucket Prefix"} value={info?.buckets?.foursight_prefix} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Login Auth0 Info">
            <InfoRow name={"Email"} value={info.login?.jwt?.email} monospace={true} copy={true} check={info.login?.jwt?.email_verified} />
            <InfoRow name={"Issuer"} value={info.login?.jwt?.iss} monospace={true} copy={true} />
            <InfoRow name={"Subject"} value={info.login?.jwt?.sub} monospace={true} copy={true} />
            <InfoRow name={"Audience"} value={info.login?.jwt?.aud} monospace={true} copy={true} />
            <InfoRow name={"Issued At"} value={info.login?.jwt?.iat} monospace={true} copy={true} />
            <InfoRow name={"Expires At"} value={info.login?.jwt?.exp} monospace={true} copy={true} />
        </InfoBox>
        <InfoBox title="Miscellany">
            <InfoRow name={"App Deployed At"} value={info.app?.deployed} monospace={true} copy={true} optional={true} />
            <InfoRow name={"App Launched At"} value={info.app?.launched} monospace={true}/>
            <InfoRow name={"Page Loaded At"} value={info.page?.loaded} monospace={true}/>
            <InfoRow name={"Package"} value={info.app?.package} monospace={true}/>
            <InfoRow name={"Stage"} value={info.app?.stage} monospace={true}/>
            <InfoRow name={"Environment"} value={info.app?.env} monospace={true}/>
            <InfoRow name={"Domain"} value={info.page?.domain} monospace={true}/>
            <InfoRow name={"Context"} value={info.page?.context} monospace={true}/>
            <InfoRow name={"Path"} value={info.page?.path} monospace={true}/>
            <InfoRow name={"Endpoint"} value={info.page?.endpoint} monospace={true}/>
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
