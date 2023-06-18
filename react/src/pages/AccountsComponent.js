import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarSpinner, StandardSpinner } from '../Spinners';
import { useSearchParams } from 'react-router-dom';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Server from '../utils/Server';
import useFetch from '../hooks/Fetch';
import useFetching from '../hooks/Fetching';
import Time from '../utils/Time';
import Tooltip from '../components/Tooltip';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

function handleFileUpload(event, accountsUploader) {
    const file = event.target.files[0]
    const reader = new window.FileReader();
    reader.onload = () => {
      const content = reader.result;
        window.alert(content)
        window.alert(typeof(content))
        const contentJson = JSON.parse(content);
        window.alert(JSON.stringify(contentJson))
        window.alert(typeof(contentJson))
        accountsUploader.refresh({
            url: Server.Url("/accounts"),
            method: "POST",
            payload: contentJson
        });
            /*
      axios.post("http://localhost:8000/api/reactapi/accounts", { content: fileContent })
        .then(response => {
          console.log(response.data);
        })
        .catch(error => {
          console.error(error);
        });
        */
    };
    reader.readAsText(file);
}

function isCurrentAccount(header, info) {
    if (!Type.IsNull(header?.app?.credentials?.aws_account_number) &&
        !Type.IsNull(info?.data?.foursight?.aws_account_number) &&
        (header?.app?.credentials?.aws_account_number === info?.data?.foursight?.aws_account_number)) {
        return true;
    }
    return false;
}

const PortalAccessKeyStatus = ({ portalAccessKeyResponse }) => {
    if (!portalAccessKeyResponse) {
        return <>&ndash;</>
    }
    else if (portalAccessKeyResponse.invalid) {
        return <b style={{color:"red"}}>Invalid</b>
    }
    else if (portalAccessKeyResponse.expired) {
        return <b style={{color:"red"}}>Expired</b>
    }
    else if (portalAccessKeyResponse.expires_at) {
        if (portalAccessKeyResponse.expires_soon) {
            return <span style={{color:"red"}}>Expires {Time.FromNow(portalAccessKeyResponse.expires_at)} ({portalAccessKeyResponse.expires_at})</span>
        }
        else {
            return <>Expires {Time.FromNow(portalAccessKeyResponse.expires_at)} ({portalAccessKeyResponse.expires_at})</>
        }
    }
    else {
        return <>OK (no expiration)</>
    }
}

const AccountInfoLeft = ({ header, info, foursightUrl }) => {

    const SslCertificateLink = ({ url }) => {
        return url && url.startsWith("https://") && <small>
          &nbsp;| <a style={{color:"inherit"}} href={Client.Path("certificates") + "/?hostname=" + url} rel="noreferrer" target="_blank">SSL</a>&nbsp;
          <a style={{color:"inherit"}} href={Client.Path("certificates") + "/?hostname=" + url} rel="noreferrer" target="_blank"><span className="fa fa-external-link" style={{position:"relative",bottom:"-1px"}}></span></a>
        </small>
    }

    const portalAccessKey = useFetch("/portal_access_key");

    return <table style={{width:"100%"}}><tbody style={{whiteSpace:"nowrap"}}>
        <tr>
            <td style={{paddingRight:"10pt",width:"10%"}}>
                { info.get("foursight.package") === "foursight-cgap" ? <>
                    Foursight-CGAP:
                </>:<>
                    { info.get("foursight.package") === "foursight" ? <>
                        Foursight-Fourfront:
                    </>:<>
                        Foursight:
                    </>}
                </>}
            </td>
            <td>
                <a style={{color:"inherit"}} href={info.get("foursight.url") || foursightUrl} rel="noreferrer" target="_blank">{info.get("foursight.url") || foursightUrl}</a>
                &nbsp;
                <a style={{color:"inherit"}} href={info.get("foursight.url") || foursightUrl} rel="noreferrer" target="_blank">
                    <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px"}}></span>
                </a>
                <SslCertificateLink url={info.get("foursight.url")} />
            </td>
        </tr>
        <tr>
            <td style={{paddingRight:"10pt"}}>
                Portal:
            </td>
            <td>
                { info.get("portal.url") ? <>
                    <a style={{color:"inherit"}} href={info.get("portal.url")} rel="noreferrer" target="_blank">{info.get("portal.url")}</a>
                    &nbsp;
                    <a style={{color:"inherit"}} href={info.get("portal.url")} rel="noreferrer" target="_blank">
                        <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px"}}></span>
                    </a>
                    &nbsp;|&nbsp;
                    <a style={{color:"inherit"}} href={info.get("portal.health_ui_url")} rel="noreferrer" target="_blank">Health</a>&nbsp;
                    <small>(<a style={{color:"inherit"}} href={info.get("portal.health_url")} rel="noreferrer" target="_blank">JSON</a>)</small>
                    &nbsp;
                    <a style={{color:"inherit"}} href={info.get("portal.health_ui_url")} rel="noreferrer" target="_blank"><span className="fa fa-external-link" style={{position:"relative",bottom:"-1px"}}></span></a>
                    <SslCertificateLink url={info.get("portal.url")} />
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                ElasticSearch:
            </td>
            <td>
                { info.get("portal.elasticsearch") ? <>
                    {info.get("portal.elasticsearch")}
                </>:<>{Char.EmptySet}</>}
                {info.data?.foursight?.versions?.elasticsearch_server && <>
                    &nbsp;(<b>{info.data?.foursight?.versions?.elasticsearch_server}</b>)
                </>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                RDS:
            </td>
            <td>
                { info.get("portal.health.database") ? <>
                    {info.get("portal.health.database")}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        { info.get("foursight.redis_url") &&
            <tr style={{fontSize:"small"}}>
                <td style={{paddingRight:"10pt"}}>
                    Redis:
                </td>
                <td>
                    {info.get("foursight.redis_url")}
                </td>
            </tr>
        }
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Identity:
            </td>
            <td style={{whiteSpace:"break-spaces",wordBreak:"break-all"}}>
                { info.get("foursight.identity") ? <>
                    {info.get("foursight.identity")}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Global Env Bucket:
            </td>
            <td>
                { info.get("foursight.s3.global_env_bucket") ? <>
                    {info.get("foursight.s3.global_env_bucket")}
                    { info.get("foursight.s3.bucket_org") && <>
                        &nbsp;(<span id={`tooltip-bucket-org-${info.get("foursight.aws_account_number")}`}>{info.get("foursight.s3.bucket_org")}</span>)
                        <Tooltip id={`tooltip-bucket-org-${info.get("foursight.aws_account_number")}`} text={`S3 Bucket Org: ${info.get("foursight.s3.bucket_org")}`} position="top" />
                    </>}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Bucket Encryption Key ID:
            </td>
            <td>
                { info.get("foursight.s3.encrypt_key_id") ? <>
                    <span id={`tooltip-encryption-key-${info.get("foursight.aws_account_number")}`}>{info.get("foursight.s3.encrypt_key_id")}</span>
                    <Tooltip id={`tooltip-encryption-key-${info.get("foursight.aws_account_number")}`} text={`S3 Encryption Key ID`} position="top" />
                </>:<> &ndash; </>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Stack Name:
            </td>
            <td>
                {info.get("foursight.stack")}
            </td>
        </tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                AWS Account:
            </td>
            <td>
                { info.get("foursight.aws_account_number") ? <>
                    <b>{info.get("foursight.aws_account_number")}</b>
                    { info.get("foursight.aws_account_name") && <>
                        &nbsp;(<span id={`tooltip-alias-${info.get("foursight.aws_account_name")}-${info?.data?.stage }`}>{info.get("foursight.aws_account_name")}</span>)
                        <Tooltip id={`tooltip-alias-${info.get("foursight.aws_account_name")}-${info?.data?.stage }`} text={`AWS Account Alias: ${info.get("foursight.aws_account_name")}`} position="top" />
                    </>}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Default Environment:
            </td>
            <td>
                { info.get("foursight.default_env.name") ? <>
                    {info.get("foursight.default_env.name")}
                    { info.get("foursight.env_count") > 1 &&
                        <span>&nbsp;({info.get("foursight.env_count")} total)</span>
                    }
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Auth0 Client ID:
            </td>
            <td>
                { info.get("foursight.auth0_client") ? <>
                    { info.get("foursight.auth0_client") && <>
                        {info.get("foursight.auth0_client")}
                    </>}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                reCAPTCHA Key ID:
            </td>
            <td>
                { info.get("foursight.re_captcha_key") ? <>
                    { info.get("foursight.re_captcha_key") && <>
                        {info.get("foursight.re_captcha_key")}
                    </>}
                </>:<> &ndash; </>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Portal Access Key:
            </td>
            <td>
                { isCurrentAccount(header, info) && !portalAccessKey.loading && <>
                    {portalAccessKey.get("key")}&nbsp;{Char.RightArrow}&nbsp;
                </> }
                <PortalAccessKeyStatus portalAccessKeyResponse={info.get("foursight.portal_access_key")} />
                <a href={`${info.get("foursight.url")}/react/${info.get("foursight.default_env.name")}/portal_access_key`} style={{color:"inherit"}} rel="noreferrer" target="_blank">
                    <span className="fa fa-external-link" style={{position:"relative",left:"6pt",bottom:"-1px"}} />
                </a>
            </td>
        </tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr style={{fontSize:"small"}}>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt",width:"10%"}}>
                Foursight Deployed:
            </td>
            <td>
                { info.get("foursight.deployed") ? <>
                    <b>{info.get("foursight.deployed")}</b> &ndash; {Time.Ago(info.get("foursight.deployed"))}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                Portal Deployed:
            </td>
            <td>
                { info.get("portal.started") ? <>
                    <b>{info.get("portal.started")}</b> &ndash; {Time.Ago(info.get("portal.started"))}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
    </tbody></table>
}

const AccountInfoRight = ({ info }) => {
    return <table style={{width:"100%",margin:"0",padding:"0"}}><tbody style={{fontSize:"small",verticalAlign:"top",whiteSpace:"nowrap"}}>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                { info.get("foursight.package") === "foursight-cgap" ? <>
                    foursight-cgap:
                </>:<>
                    foursight:
                </>}
            </td>
            <td>
                {info.get("foursight.versions.foursight") ? <>
                    <b>{info.get("foursight.versions.foursight")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                foursight-core:
            </td>
            <td>
                {info.get("foursight.versions.foursight_core") ? <>
                    <b>{info.get("foursight.versions.foursight_core")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                foursight-dcicutils:
            </td>
            <td>
                {info.get("foursight.versions.dcicutils") ? <>
                    <b>{info.get("foursight.versions.dcicutils")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                tibanna:
            </td>
            <td>
                {info.get("foursight.versions.tibanna") ? <>
                    <b>{info.get("foursight.versions.tibanna")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                tibanna-ff:
            </td>
            <td>
                {info.get("foursight.versions.tibanna_ff") ? <>
                    <b>{info.get("foursight.versions.tibanna_ff")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                foursight-python:
            </td>
            <td>
                {info.get("foursight.versions.python") ? <>
                    <b>{info.get("foursight.versions.python")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                chalice:
            </td>
            <td>
                {info.get("foursight.versions.chalice") ? <>
                    <b>{info.get("foursight.versions.chalice")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                portal:
            </td>
            <td>
                {info.get("portal.versions.portal") ? <>
                    <b>{info.get("portal.versions.portal")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                portal-project:
            </td>
            <td>
                {info.get("portal.health.project_version") ? <>
                    <b>{info.get("portal.health.project_version")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                portal-dcicutils:
            </td>
            <td>
                {info.get("portal.versions.dcicutils") ? <>
                    <b>{info.get("portal.versions.dcicutils")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                portal-python:
            </td>
            <td>
                {info.get("portal.health.python_version") ? <>
                    <b>{info.get("portal.health.python_version")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                snovault:
            </td>
            <td>
                {info.get("portal.versions.snovault") ? <>
                    <b>{info.get("portal.versions.snovault")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                elasticsearch-server:
            </td>
            <td>
                {info.get("foursight.versions.elasticsearch_server") ? <>
                    <b>{info.get("foursight.versions.elasticsearch_server")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                elasticsearch:
            </td>
            <td>
                {info.get("foursight.versions.elasticsearch") ? <>
                    <b>{info.get("foursight.versions.elasticsearch")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                elasticsearch-dsl:
            </td>
            <td>
                {info.get("foursight.versions.elasticsearch_dsl") ? <>
                    <b>{info.get("foursight.versions.elasticsearch_dsl")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        { info.get("foursight.versions.redis_server") && <>
            <tr>
                <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                    redis:
                </td>
                <td>
                    {info.get("foursight.versions.redis") ? <>
                        <b>{info.get("foursight.versions.redis")}</b>
                    </>:<>{Char.EmptySet}</>}
                </td>
            </tr>
            <tr>
                <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                    redis-server:
                </td>
                <td>
                    {info.get("foursight.versions.redis_server") ? <>
                        <b>{info.get("foursight.versions.redis_server")}</b>
                    </>:<>{Char.EmptySet}</>}
                </td>
            </tr>
        </>}
    </tbody></table>
}

export const AccountInfo = ({ account, header, foursightUrl, all, decrementAccountCount, brighten }) => {

    const info = useFetch(`/accounts_from_s3/${account.id}`, { onDone: () => decrementAccountCount(), cache: true, nofetch: true });

    useEffect(() => {
        fetchData();
    }, []);

    function fetchData() {
        info.fetch();
    }

    function refreshData() {
        info.refresh();
    }

    function isCurrentAccountAndStage(header, info) {
        return isCurrentAccount(header, info) && (header?.app?.stage === info?.data?.stage);
    }

    if (!all && !isCurrentAccount(header, info)) return null;
    return <>
        <div className={isCurrentAccountAndStage(header, info) ? "box" : "box lighten"} style={{marginTop:"4pt",marginBottom:"8pt",filter:brighten ? "brightness(1.1)" : ""}}>
            {isCurrentAccount(header, info) ? <>
                <b id={`tooltip-current-${account.name}-${info?.data?.stage}`}>{info.data?.name || account.name}</b>
                <Tooltip id={`tooltip-current-${account.name}-${info?.data?.stage}`} text={`This is your current account: ${info.get("foursight.aws_account_number")}`} position="top" />
            </>:<>
                <b id={`tooltip-account-${account.name}-${account.stage}`}>{info.data?.name || account.name}</b>
                <Tooltip id={`tooltip-account-${account.name}-${account.stage}`} text={`AWS Account: ${info.get("foursight.aws_account_number")}.`} position="top" />
            </>}
            { info.get("foursight.stage") ? <>
                &nbsp;&nbsp;&mdash;&nbsp;&nbsp;<span id={`tooltip-stage-${account.id}-${info.get("foursight.stage")}`}>{info.get("foursight.stage")}</span>
                <Tooltip id={`tooltip-stage-${account.id}-${info.get("foursight.stage")}`} text={`Stage: ${info.get("foursight.stage")}`} position="top" />
            </>:<>
                { account.stage && <>
                    &nbsp;&nbsp;&mdash;&nbsp;&nbsp;<span id={`tooltip-stage-${account.id}-${account.stage}`}>{account.stage}</span>
                    <Tooltip id={`tooltip-stage-${account.id}-${account.stage}`} text={`Stage: ${account.state}`} position="top" />
                </>}
            </>}
            <div style={{float:"right",marginTop:"-2pt"}}>
                { info.loading ? <>
                    <div style={{paddingTop:"7pt",paddingRight:"2pt"}}><BarSpinner /></div>
                </>:<>
                    { info.data?.__showraw ? <>
                        <span id={`tooltip-hide-raw-${account.id}`} onClick={() => { info.data.__showraw = false; info.update(); }} style={{cursor:"pointer"}}>{Char.DownArrow}</span>
                        <Tooltip id={`tooltip-hide-raw-${account.id}`} text={"Click to hide raw result."} position="top" />
                    </>:<>
                        <span id={`tooltip-show-raw-${account.id}`} onClick={() => {info.data.__showraw = true;info.update(); }} style={{cursor:"pointer"}}>{Char.UpArrow}</span>
                        <Tooltip id={`tooltip-show-raw-${account.id}`} text={"Click to show raw result."} position="top" />
                    </>}
                    <span onClick={refreshData} style={{cursor:"pointer"}}>&nbsp;&nbsp;{Char.Refresh}</span>
                </>}
            </div>
            <div style={{marginTop:"3pt",marginBottom:"4pt",border:"1px",borderTop:"dotted"}}></div>
            <table><tbody>
                <tr style={{verticalAlign:"top"}}>
                    <td style={{width:"70%"}}>
                        <AccountInfoLeft header={header} info={info} foursightUrl={foursightUrl} />
                    </td>
                    <td style={{paddingLeft:"10pt",width:"12pt"}} />
                    <td style={{marginLeft:"12pt",borderLeft:"1px solid"}} />
                    <td style={{width:"30%",paddingLeft:"12pt",textAlign:"top",verticalAlign:"top"}}>
                        <AccountInfoRight info={info} header={header} />
                    </td>
                </tr>
            </tbody></table>
            { info.data?.__showraw && <>
                <div style={{marginTop:"8pt",marginBottom:"8pt",border:"1px",borderTop:"solid"}}></div>
                <pre style={{background:"inherit"}}>
                    {Yaml.Format(info.data)}
                </pre>
            </>}
        </div>
    </>
}

const AccountsComponent = ({ header }) => {

    const accountsUploader = useFetch(Server.Url("/accounts"), { method: "POST", nofetch: true });

    const [ args, setArgs ] = useSearchParams();
    const argsAll = args.get("all");
    const [ all, setAll ] = useState(argsAll?.toLowerCase() === "true" || argsAll === "1" ? true : false);
    const accounts = useFetch("/accounts_from_s3", { cache: true });
    const [ accountCount, setAccountCount ] = useState(0);
    const [ startup, setStartup ] = useState(true);
    const [ fetching ] = useFetching();

    useEffect(() => {
        refreshAll();
    }, []);

    function refreshAll() {
        accounts.refresh("/accounts_from_s3", { cache: true, onDone: (response) => { setAccountCount(response.data?.length) }});
    }

    function decrementAccountCount() {
        setAccountCount(count => { return count - 1; });
        setStartup(false);
    }

    function toggleAll() {
        if (all) {
            delete args["all"]
		    setArgs({...args});
            setAll(false);
        }
        else {
		    setArgs({...args, "all": "true" });
            setAll(true);
        }
    }

    return <>
        <div style={{borderBottom:"2px solid black",marginBottom:"8pt"}}>
            <div style={{marginTop:"0pt"}}><b id={`tooltip-known-accounts`}>Known Accounts</b>
                <Tooltip id={`tooltip-known-accounts`} text={`This info from: ${header?.app?.accounts_file_from_s3}`} position="top" />
                <div style={{float:"right",display:"inline",fontSize:"small",marginRight:"4pt",marginTop:"0pt"}}>
                <span id="tooltip-upload">
                    <label for="accounts-file-upload"><span style={{position:"relative",bottom:"1pt",right:"1pt",cursor:"pointer"}}>&#x2630;</span></label>
                    <input id="accounts-file-upload" type="file" onChange={(event) => handleFileUpload(event, accountsUploader)}></input>
                </span>
                <Tooltip id="tooltip-upload" text="Click to upload accounts files." position="top" />
                &nbsp;|&nbsp;
                { (all)  ? <>
                    <span id={`tooltip-show-local`} style={{cursor:"pointer"}} onClick={toggleAll}>Local</span>&nbsp;|&nbsp;
                    <Tooltip id={`tooltip-show-local`} text={`Click to show accounts within AWS account: ${header?.app?.credentials?.aws_account_number} (${header?.app?.credentials?.aws_account_name})`} position="top" />
                    <b id={`tooltip-showing-all`} style={{cursor:"pointer"}} onClick={toggleAll}>All</b>
                    <Tooltip id={`tooltip-showing-all`} text={"Showing all known accounts."} position="top" />
                </>:<>
                    <b id={`tooltip-showing-local`} style={{cursor:"pointer"}} onClick={toggleAll}>Local</b>&nbsp;|&nbsp;
                    <Tooltip id={`tooltip-showing-local`} text={`Showing accounts within AWS account: ${header?.app?.credentials?.aws_account_number} (${header?.app?.credentials?.aws_account_name})`} position="top" />
                    <span id={`tooltip-show-all`} style={{cursor:"pointer"}} onClick={toggleAll}>All</span>
                    <Tooltip id={`tooltip-show-all`} text={"Click to show all known accounts."} position="top" />
                </>}
                </div>
            </div>
        </div>
        { accounts.length > 0 ? <>
            { accounts?.map((account, index) => <React.Fragment key={account.id}>
                <AccountInfo account={account} header={header} all={all} decrementAccountCount={decrementAccountCount} foursightUrl={account.foursight_url} />
            </React.Fragment>)}
            { ((startup || (accountCount > 0)) && (fetching.length > 0) /* bit of hack - need to straighten out this count/decrement stuff */ ) && <>
                <div className="box" style={{paddingBottom:"10pt"}}>
                    <StandardSpinner label="Loading accounts info" style={{paddingBottom:"0pt"}} />
                </div>
            </>}
        </>:<>
            <div className="box" style={{paddingBottom:"10pt"}} >
                { (accounts.loading) ? <>
                    <StandardSpinner label="Loading accounts list" />
                </>:<>
                    No accounts info found.
                </>}
            </div>
        </>}
    </>
}

export default AccountsComponent;
