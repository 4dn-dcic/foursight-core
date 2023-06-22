import axios from 'axios';
import React, { useEffect, useState } from 'react';
import Uuid from 'react-uuid';
import { BarSpinner, StandardSpinner } from '../Spinners';
import { useSearchParams } from 'react-router-dom';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import { ExternalLink } from '../Components';
import Image from '../utils/Image';
import Json from '../utils/Json';
import Server from '../utils/Server';
import useFetch from '../hooks/Fetch';
import useFetching from '../hooks/Fetching';
import Time from '../utils/Time';
import Styles from '../Styles';
import Tooltip from '../components/Tooltip';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

function handleFileUpload(event, accountsUploader) {
    const file = event.target.files[0]
    const reader = new window.FileReader();
    reader.onload = () => {
      const content = reader.result;
        const contentJson = JSON.parse(content);
        accountsUploader.refresh({
            url: Server.Url("/accounts_file"),
            method: "POST",
            payload: contentJson
        });
        window.location.reload();
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
            return <span style={{color:"red"}}>Expires {Time.FromNow(portalAccessKeyResponse.expires_at)} {Char.RightArrow} {portalAccessKeyResponse.expires_at}</span>
        }
        else {
            return <>Expires {Time.FromNow(portalAccessKeyResponse.expires_at)} {Char.RightArrow} {portalAccessKeyResponse.expires_at}</>
        }
    }
    else {
        return <>No expiration</>
    }
}

const SslCertificateLink = ({ url }) => {
    const sslCertificate = useFetch(url ? `/certificates?hostname=${url}` : null);
    function sslCertificateExpiresSoon() {
        return Type.IsArray(sslCertificate.data) ? sslCertificate.data[0]?.expires_soon : null;
    }
    function sslCertificateExpiresMessage() {
        if (!Type.IsArray(sslCertificate.data)) return "";
        const invalid = sslCertificate.data[0]?.invalid;
        const expired = sslCertificate.data[0]?.expired;
        const expiresSoon = sslCertificate.data[0]?.expired;
        const expiresAt = sslCertificate.data[0]?.expires_at;
        if (invalid) {
            return `SSL certificate is invalid!`;
        }
        else if (expired) {
            return `SSL certificate expired ${Time.Ago(expiresAt)} (${expiresAt})`;
        }
        else if (expiresSoon) {
            return `SSL certificate expires ${Time.FromNow(expiresAt)} (${expiresAt}) -> Soon!`;
        }
        else {
            return `SSL certificate expires ${Time.FromNow(expiresAt)} (${expiresAt})`;
        }
    }
    const uuid = Uuid();
    return url && url.startsWith("https://") && <small>
        <small style={{marginLeft:"3pt",marginRight:"3pt"}}>|</small>
        <a style={{color:sslCertificateExpiresSoon() ? "red" : "inherit"}} href={Client.Path("certificates") + "/?hostname=" + url} id={`tooltip-ssl-expires-${url}`} rel="noreferrer" target="_blank">SSL</a>&nbsp;
        <ExternalLink
            href={Client.Path("certificates") + "/?hostname=" + url}
            style={{marginLeft:"1pt"}} />
        <Tooltip id={`tooltip-ssl-expires-${url}`} text={`${sslCertificateExpiresMessage()}`} position="top" />
    </small>
}

const S3BucketLink = ({ bucket, name, line = true }) => {
    if (!bucket) return <></>
    return <>
        { name && <>
            <b>{name}</b>:&nbsp;&nbsp;
        </> }
        <a href={`https://s3.console.aws.amazon.com/s3/buckets/${bucket}`} style={{color:"inherit"}} rel="noreferrer" target="_blank">{bucket}</a>
        <ExternalLink
            href={`https://s3.console.aws.amazon.com/s3/buckets/${bucket}`}
            style={{marginLeft:"4pt"}} />
        { line && <br /> }
    </>
}

const Row = ({ title, value, additionalValue, externalLink, show = true }) => { 
    if (!show || !value) return <></>
    return <tr style={{fontSize:"small"}}>
        <td style={{paddingRight:"10pt"}}>
            {title}:
        </td>
        <td>
            { value ? <>
                {value}
                { additionalValue && <>
                    <small style={{marginLeft:"2pt",marginRight:"2pt"}}>|</small>{additionalValue}
                </> }
                { externalLink &&
                    <ExternalLink
                        href={externalLink}
                        style={{marginLeft:"4pt"}} />
                }
            </>:<>{Char.EmptySet}</>}
        </td>
    </tr>
}

const Separator = () => {
    return <>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
    </>
}

const AccountInfoLeft = ({ header, info, foursightUrl }) => {

    const portalAccessKey = useFetch("/portal_access_key");
    const [ showBuckets, setShowBuckets ] = useState(false);

    function toggleShowBuckets() {
        setShowBuckets(!showBuckets);
    }

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
                <ExternalLink
                    href={info.get("foursight.url") || foursightUrl}
                    style={{marginLeft:"1pt"}} />
                <small style={{marginLeft:"3pt",marginRight:"3pt"}}>|</small>
                <small>
                    <a href={`${info.get("foursight.url")}/reactapi/header`} style={{color:"inherit"}} rel="noreferrer" target="_blank">API</a>
                    <ExternalLink
                        href={`${info.get("foursight.url")}/reactapi/header`}
                        style={{marginLeft:"4pt"}} />
                </small>
                <SslCertificateLink url={info.get("foursight.url")} />
            </td>
        </tr>
        <tr>
            <td style={{paddingRight:"10pt"}}>
                { info.get("foursight.package") === "foursight" ? <>
                    Fourfront:
                </>:<>
                    CGAP-Portal:
                </> }
            </td>
            <td>
                { info.get("portal.url") ? <>
                    <a style={{color:"inherit"}} href={info.get("portal.url")} rel="noreferrer" target="_blank">{info.get("portal.url")}</a>
                    &nbsp;
                    <ExternalLink
                        href={info.get("portal.url")}
                        style={{marginLeft:"1pt"}} />
                    &nbsp;|&nbsp;
                    <small><a style={{color:"inherit"}} href={info.get("portal.health_ui_url")} rel="noreferrer" target="_blank">Health</a>&nbsp;</small>
                    <small>(<a style={{color:"inherit"}} href={info.get("portal.health_url")} rel="noreferrer" target="_blank">JSON</a>)</small>
                    &nbsp;
                    <ExternalLink
                        href={info.get("portal.health_ui_url")}
                        style={{marginLeft:"1pt"}} />
                    {info.get("portal.health.indexer") == "true" && <small title={info.get("portal.health.indexer_server")}>
                        &nbsp;| <a style={{color:"inherit"}} href={`${info.get("portal.url")}/indexing_status`} rel="noreferrer" target="_blank">Indexer</a>&nbsp;
                        <ExternalLink
                            href={`${info.get("portal.url")}/indexing_status?format=json`}
                            style={{marginLeft:"1pt"}} />
                    </small> }
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
                    {info.get("portal.elasticsearch").replace(/:443$/,"")}
                    { info.get("foursight.es_cluster") && <>
                        <small style={{marginLeft:"2pt",marginRight:"2pt"}}>|</small>{info.get("foursight.es_cluster")}
                        <ExternalLink
                            href={`https://us-east-1.console.aws.amazon.com/aos/home?region=us-east-1#opensearch/domains/${info.get("foursight.es_cluster")}`}
                            style={{marginLeft:"4pt"}} />
                        </> }
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <Row title="RDS (Foursight)" value={info.get("foursight.rds")}
             externalLink={`https://us-east-1.console.aws.amazon.com/rds/home?region=us-east-1#databases:`}
             show={!info.get("portal.health.database")?.startsWith(info.get("foursight.rds"))} />
        <Row title="RDS" value={info.get("portal.health.database")}
             additionalValue={info.get("foursight.rds_name")}
             externalLink={`https://us-east-1.console.aws.amazon.com/rds/home?region=us-east-1#database:id=${info.get("foursight.rds_name")};is-cluster=false`} />
        <Row title="Redis" value={info.get("foursight.redis_url")}
             externalLink={`https://us-east-1.console.aws.amazon.com/memorydb/home?region=us-east-1#/clusters`} />
        <Row title="SQS" value={info.get("foursight.sqs_url")}
             externalLink={`https://us-east-1.console.aws.amazon.com/sqs/v2/home?region=us-east-1#/queues/${encodeURIComponent(info.get('foursight.sqs_url'))}`} />
        <Separator />
        { info.get("foursight.identity") == info.get("portal.identity") ? <>
            <Row title="Identity" value={info.get("foursight.identity")}
                 externalLink={`${info.get("foursight.url")}/react/${info.get("foursight.default_env.name")}/aws/infrastructure?secrets=${info.get("foursight.identity")}`} />
        </>:<>
            <Row title="Foursight Identity" value={info.get("foursight.identity")}
                 externalLink={`${info.get("foursight.url")}/react/${info.get("foursight.default_env.name")}/aws/infrastructure?secrets=${info.get("foursight.identity")}`} />
            <Row title="Portal Identity" value={info.get("portal.identity")}
                 externalLink={`${info.get("foursight.url")}/react/${info.get("foursight.default_env.name")}/aws/infrastructure?secrets=${info.get("portal.identity")}`} />
        </> }
        <Row title="Stack Name" value={info.get("foursight.stack")}
             externalLink={`https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/stackinfo?filteringStatus=active&viewNested=true&stackId=${info.get("foursight.stack")}`} />
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt",verticalAlign:"top"}}>
                Global Env Bucket:
            </td>
            <td>
                { info.get("foursight.s3.global_env_bucket") ? <>
                    {info.get("foursight.s3.global_env_bucket")}
                    <ExternalLink
                        href={`https://s3.console.aws.amazon.com/s3/buckets/${info.get("foursight.s3.global_env_bucket")}?region=us-east-1&tab=objects`}
                        style={{marginLeft:"6pt"}} />
                    { info.get("foursight.s3.bucket_org") && <>
                        &nbsp;&nbsp;(<span id={`tooltip-bucket-org-${info.get("foursight.aws_account_number")}`}>{info.get("foursight.s3.bucket_org")}</span>)
                        <Tooltip id={`tooltip-bucket-org-${info.get("foursight.aws_account_number")}`} text={`S3 Bucket Org: ${info.get("foursight.s3.bucket_org")}`} position="top" />
                    </>}
                    <small style={{marginLeft:"3pt",marginRight:"3pt"}}>|</small>
                    { showBuckets ? <>
                        <span onClick={toggleShowBuckets} className="pointer">Buckets {Char.UpArrow}</span>
                    </>:<>
                        <b onClick={toggleShowBuckets} className="pointer">Buckets {Char.DownArrow}</b>
                         <div className="box" style={{background:"inherit",border:"1pt gray dotted",marginTop:"2pt",padding:"4pt"}}>
                            <S3BucketLink name="System" bucket={info.get("foursight.s3.buckets.sys_bucket")} /> 
                            <S3BucketLink name="Output" bucket={info.get("foursight.s3.buckets.outfile_bucket")} />
                            <S3BucketLink name="Raw" bucket={info.get("foursight.s3.buckets.raw_file_bucket")} />
                            <S3BucketLink name="Metadata" bucket={info.get("foursight.s3.buckets.metadata_bucket")} />
                            <S3BucketLink name="Blobs" bucket={info.get("foursight.s3.buckets.blob_bucket")} />
                            <S3BucketLink name="Tibanna CWLs" bucket={info.get("foursight.s3.buckets.tibanna_cwls_bucket")} />
                            <S3BucketLink name="Tibanna Output" bucket={info.get("foursight.s3.buckets.tibanna_output_bucket")} />
                         </div>
                    </> }
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Bucket Encryption ID:
            </td>
            <td>
                { info.get("foursight.s3.encrypt_key_id") ? <>
                    <span id={`tooltip-encryption-key-${info.get("foursight.aws_account_number")}`}>{info.get("foursight.s3.encrypt_key_id")}</span>
                    <Tooltip id={`tooltip-encryption-key-${info.get("foursight.aws_account_number")}`} text={`S3 Bucket Encryption Key ID`} position="top" />
                    <ExternalLink
                        href={`https://us-east-1.console.aws.amazon.com/kms/home?region=us-east-1#/kms/keys/${info.get("foursight.s3.encrypt_key_id")}`}
                        style={{marginLeft:"6pt"}} />
                </>:<> &ndash; </>}
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
                    <ExternalLink
                        href={`${info.get("foursight.url")}/reactapi/auth0_config`}
                        style={{marginLeft:"4pt"}} />
                    &nbsp;|&nbsp;
                    <a style={{color:"inherit"}} href={`${info.get("portal.url")}/auth0_config`} rel="noreferrer" target="_blank">
                        Portal
                    </a>
                    <ExternalLink
                        href={`${info.get("portal.url")}/auth0_config?format=json`}
                        style={{marginLeft:"4pt"}} />
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
                    {portalAccessKey.get("key")}&nbsp;|&nbsp;
                </> }
                <PortalAccessKeyStatus portalAccessKeyResponse={info.get("foursight.portal_access_key")} />
                <ExternalLink
                    href={`${info.get("foursight.url")}/react/${info.get("foursight.default_env.name")}/portal_access_key`}
                    style={{marginLeft:"6pt"}} />
                <span id={`tooltip-s3-access-key`}>
                    <small style={{marginLeft:"3pt",marginRight:"3pt"}}>|</small>
                    <a href={`https://s3.console.aws.amazon.com/s3/object/${header?.app?.accounts_file?.replace("s3://", "").replace("known_accounts", "access_key_foursight")}`} style={{color:"inherit"}} rel="noreferrer" target="_blank">S3</a>
                    <ExternalLink
                        href={`https://s3.console.aws.amazon.com/s3/object/${header?.app?.accounts_file?.replace("s3://", "").replace("known_accounts", "access_key_foursight")}`}
                        style={{marginLeft:"4pt"}} />
                        <Tooltip id={`tooltip-s3-access-ke`} text={`Location of Portal access key in AWS S3.`} position="bottom" />
                </span>
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

const VersionRow = ({ title, version }) => {
    return <tr>
        <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}> {title} </td>
        <td>
            { version ? <>
                <b>{version}</b>
            </>:<>{Char.EmptySet}</>}
        </td>
    </tr>
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
        <VersionRow title="foursight-core" version={info.get("foursight.versions.foursight_core")} />
        <VersionRow title="dcicutils" version={info.get("foursight.versions.dcicutils")} />
        <VersionRow title="tibanna" version={info.get("foursight.versions.tibanna")} />
        <VersionRow title="tibanna_ff" version={info.get("foursight.versions.tibanna_ff")} />
        <VersionRow title="boto3" version={info.get("foursight.versions.boto3")} />
        <VersionRow title="botocore" version={info.get("foursight.versions.botocore")} />
        <VersionRow title="chalice" version={info.get("foursight.versions.chalice")} />
        <VersionRow title="redis" version={info.get("foursight.versions.redis")} />
        <VersionRow title="python" version={info.get("foursight.versions.python")} />
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <VersionRow title="portal" version={info.get("portal.versions.portal")} />
        { (info.get("portal.health.project_version") != info.get("portal.versions.portal")) && <>
            <VersionRow title="portal-project" version={info.get("portal.health.project_version")} />
        </> }
        <VersionRow title="snovault" version={info.get("portal.versions.snovault")} />
        <VersionRow title="dcicutils" version={info.get("portal.versions.dcicutils")} />
        <VersionRow title="python" version={info.get("portal.health.python_version")} />
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <VersionRow title="elasticsearch-server" version={info.get("foursight.versions.elasticsearch_server")} />
        <VersionRow title="elasticsearch" version={info.get("foursight.versions.elasticsearch")} />
        <VersionRow title="elasticsearch-dsl" version={info.get("foursight.versions.elasticsearch_dsl")} />
        { info.get("foursight.versions.redis_server") && <>
            <VersionRow title="redis-server" version={info.get("foursight.versions.redis_server")} />
        </>}
    </tbody></table>
}

export const AccountInfo = ({ account, header, foursightUrl, all, decrementAccountCount, brighten }) => {

    const info = useFetch(`/accounts/${account.id}`, { onDone: () => decrementAccountCount(), cache: true, nofetch: true });

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
                &nbsp;&nbsp;<b>&ndash;</b>&nbsp;&nbsp;<span id={`tooltip-stage-${account.id}-${info.get("foursight.stage")}`}>{info.get("foursight.stage")}</span>
                <Tooltip id={`tooltip-stage-${account.id}-${info.get("foursight.stage")}`} text={`Stage: ${info.get("foursight.stage")}`} position="top" />
            </>:<>
                { account.stage && <>
                    &nbsp;&nbsp;<b>&ndash;</b>&nbsp;&nbsp;<span id={`tooltip-stage-${account.id}-${account.stage}`}>{account.stage}</span>
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
                    <td style={{width:"80%"}}>
                        <AccountInfoLeft header={header} info={info} foursightUrl={foursightUrl} />
                    </td>
                    <td style={{paddingLeft:"6pt",width:"12pt"}} />
                    <td style={{marginLeft:"12pt",borderLeft:"1px solid"}} />
                    <td style={{width:"30%",paddingLeft:"8pt",textAlign:"top",verticalAlign:"top"}}>
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
    const accountsFileData = useFetch(Server.Url("/accounts_file"), { nocache: true });

    const [ args, setArgs ] = useSearchParams();
    const argsAll = args.get("all");
    const [ all, setAll ] = useState(argsAll?.toLowerCase() === "true" || argsAll === "1" ? true : false);
    const accounts = useFetch("/accounts", { cache: true });
    const [ accountCount, setAccountCount ] = useState(0);
    const [ startup, setStartup ] = useState(true);
    const [ fetching ] = useFetching();
    const [ showAccountsFileContent, setShowAccountsFileContent ] = useState(false);

    useEffect(() => {
        refreshAll();
    }, []);

    function refreshAll() {
        accounts.refresh("/accounts", { cache: true, onDone: (response) => { setAccountCount(response.data?.length) }});
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

    function toggleShowAccountsFileContent() {
        setShowAccountsFileContent(!showAccountsFileContent);
    }

    return <>
        <div style={{borderBottom:"2px solid black",marginBottom:"8pt"}}>
            <div style={{marginTop:"0pt",cursor:"pointer"}}><b id={`tooltip-known-accounts`} onClick={toggleShowAccountsFileContent}>Known Accounts</b>
                <Tooltip id={`tooltip-known-accounts`} text={`This info from: ${header?.app?.accounts_file}`} position="top" />
                <div style={{float:"right",display:"inline",fontSize:"small",marginRight:"4pt",marginTop:"0pt"}}>
                { showAccountsFileContent ? <>
                    <b onClick={toggleShowAccountsFileContent} className="pointer">{Char.DownArrow} Help</b>
                </>:<>
                    <span onClick={toggleShowAccountsFileContent} className="pointer">{Char.UpArrow} Help</span>
                </> }
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
        { showAccountsFileContent &&
            <pre className="box" style={{background:"#FCF8E3",color:"black",marginTop:"2pt"}}>
                <div style={{fontFamily:"tahoma",borderBottom:"1px black solid",paddingBottom:"6pt"}}>
                <span style={{float:"right",cursor:"pointer"}} onClick={toggleShowAccountsFileContent}>X&nbsp;</span>
                    Known account info is stored in:&nbsp;
                    <a href={`https://s3.console.aws.amazon.com/s3/object/${header?.app?.accounts_file?.replace("s3://", "")}`} style={{color:"inherit"}} rel="noreferrer" target="_blank">
                        <b>{header?.app?.accounts_file}</b>
                        <ExternalLink
                            href={`https://s3.console.aws.amazon.com/s3/object/${header?.app?.accounts_file?.replace("s3://", "")}`}
                            bold={true}
                            style={{marginLeft:"6pt"}} />
                    </a><br />
                    { accounts.status == 404 && <>
                        This file does <b>not</b> currently exist. Example below. <br />
                    </> }
                    Click
                    <span id="tooltip-upload">&nbsp;
                        <label htmlFor="accounts-file-upload"><span style={{cursor:"pointer"}}><u>here</u></span></label>
                        <input id="accounts-file-upload" type="file" onChange={(event) => handleFileUpload(event, accountsUploader)}></input>
                    &nbsp;</span>
                    <Tooltip id="tooltip-upload" text="Click to upload accounts files." position="top" />
                    to upload new account info like the below from a file in JSON format into this S3 location.
                </div>
                <div style={{paddingTop:"6pt"}}>
                    <span style={{float:"right"}}>
                        <span style={{fontSize:"0",opacity:"0"}} id={"accounts_json"}>{JSON.stringify(accounts.data)}</span>
                        <span id="tooltip-copy"><img id="tooltip-copy" src={Image.Clipboard()} alt="copy" onClick={() => Clipboard.Copy("accounts_json")} style={{float:"right",height:"20px",cursor:"copy"}} /></span>
                        <Tooltip id="tooltip-copy" text="Click to copy this accounts info JSON data to the clipboard." position="left" />
                    </span>
                    { accounts.status == 200 ? <>
                        &nbsp;&nbsp;{Yaml.Format(accountsFileData.data)}
                    </>:<>
                        { accounts.status == 404 ? <>
                            {Json.Format([{name: "example-account-name", foursight_url: "https://example-foursight-url/api", stage: "dev-or-prod"}])}
                        </>:<>
                            {Yaml.Format({})}
                        </> }
                    </>}
                </div>
            </pre>
        }
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
