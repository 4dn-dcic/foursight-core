import axios from 'axios';
import React, { useEffect, useState } from 'react';
import Uuid from 'react-uuid';
import { BarSpinner, StandardSpinner } from '../Spinners';
import { useSearchParams } from 'react-router-dom';
import Char from '../utils/Char';
import Client from '../utils/Client';
import Clipboard from '../utils/Clipboard';
import DateTime from '../utils/DateTime';
import { ExternalLink } from '../Components';
import Image from '../utils/Image';
import Json from '../utils/Json';
import JsonToggleDiv from '../components/JsonToggleDiv';
import useFetch from '../hooks/Fetch';
import useFetching from '../hooks/Fetching';
import { Secrets } from './aws/Secrets';
import Server from '../utils/Server';
import Str from '../utils/Str';
import Styles from '../Styles';
import Time from '../utils/Time';
import Tooltip from '../components/Tooltip';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';
import useHeader from '../hooks/Header';

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

function isCurrentAccount(header, account) {
    if ((!Type.IsNull(header?.app?.credentials?.aws_account_number) &&
         !Type.IsNull(account?.data?.foursight?.aws_account_number) &&
         (header?.app?.credentials?.aws_account_number === account?.data?.foursight?.aws_account_number)) ||
        (account?.name === "current") ||
        (account?.name === "localhost")) {
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
            return <span style={{color:"red"}}>Expires {Time.FromNow(portalAccessKeyResponse.expires_at, true, false)}
                {Char.RightArrow} {DateTime.Format(portalAccessKeyResponse.expires_at)}</span>
        }
        else {
            return <>Expires {Time.FromNow(portalAccessKeyResponse.expires_at, true, false)}
                {Char.RightArrow} {DateTime.Format(portalAccessKeyResponse.expires_at)}</>
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
            return `SSL certificate expired ${Time.Ago(expiresAt, true, false)} (${expiresAt})`;
        }
        else if (expiresSoon) {
            return `SSL certificate expires ${Time.FromNow(expiresAt, true, false)} (${expiresAt}) -> Soon!`;
        }
        else {
            return `SSL certificate expires ${Time.FromNow(expiresAt, true, false)} (${expiresAt})`;
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

const Row = ({ title, value, additionalValue, externalLink, children, tooltip = null, showEmpty = false, small = true, bold = false, show = true }) => { 
    if (!show || (!value && !showEmpty)) return <></>
    const tooltipText = Type.IsArray(tooltip) ? tooltip[0] : null;
    const tooltipId = Type.IsArray(tooltip) ? tooltip[1] : null;
    return <tr style={{fontSize:small ? "small" : "inherit"}}>
        <td style={{paddingRight:"7pt",verticalAlign:"top"}}>
            {title}:
        </td>
        <td>
            { value ? <>
                { bold ? <b id={tooltipId}>{value}</b> : <span id={tooltipId}>{value}</span> }
                { additionalValue && <>
                    <small style={{marginLeft:"3pt",marginRight:"2pt"}}>|</small>{additionalValue}
                </> }
                { externalLink &&
                    <ExternalLink
                        href={externalLink}
                        style={{marginLeft:"4pt"}} />
                }
                { children && <>{children}</> }
            </>:<>&ndash;</>}
            { tooltipText && tooltipId &&
                <Tooltip id={tooltipId} text={tooltipText} position="top" />
            }
        </td>
    </tr>
}

const VersionRow = ({ title, version, show = true, using = null }) => {
    if (!show || !version) return <></>
    return <tr>
        <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>{title}:</td>
        <td>
            { version ? <>
                <b>{version}</b>
                { using && <>
                    &nbsp;<b>{Char.Check}</b>
                </> }
            </>:<>{Char.EmptySet}</>}
        </td>
    </tr>
}

const SecretsDropdown = ({ header, account, name }) => {
    const [ showIdentity, setShowIdentity ] = useState(false);
    function toggleShowIdentity() { setShowIdentity(!showIdentity); }
    return <>
        { isCurrentAccount(header, account) && <span id={`tooltip-gac-${name}`}>
            <small style={{marginLeft:"3pt",marginRight:"3pt"}}>|</small>
            { showIdentity ? <>
                <b onClick={toggleShowIdentity} className="pointer">GAC {Char.DownArrow}</b>
            </>:<>
                <span onClick={toggleShowIdentity} className="pointer">GAC <b>{Char.UpArrow}</b></span>
            </> }
            { showIdentity && <Secrets name={name} embedded={true} /> }
        </span> }
        <Tooltip id={`tooltip-gac-${name}`} text={`Global Application Configuration (AWS Secrets): ${name}`} position="right" shape="squared" />
    </>
}

const KnownEnvsBox = ({ header, account }) => {
    let knownEnvs = isCurrentAccount(header, account) ? header?.auth?.known_envs?.sort((a, b) => a.full_name > b.full_name ? 1 : -1) : null;
    return <>
        <div className="box" style={{background:"inherit",border:"1pt gray dotted",marginTop:"2pt",marginBottom:"2pt",padding:"4pt",color:"inherit"}}>
            {knownEnvs?.map(env => <span key={`${env.full_name}`}>
                <b>{env.full_name}</b> (<span id={`tooltip-env-${env.full_name}`}>{env.public_name}</span>)<br />
                <Tooltip id={`tooltip-env-${env.full_name}`} text={`Public name of environment.`} position="right" shape="squared" />
            </span> )}
        </div>
    </>
}

const Separator = () => {
    return <>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
    </>
}

const AccountInfoLeft = ({ header, account, foursightUrl }) => {

    const portalAccessKey = useFetch("/portal_access_key");
    const [ showBuckets, setShowBuckets ] = useState(false);
    const [ showIdentity, setShowIdentity ] = useState(false);
    const [ showEcosystem, setShowEcosystem ] = useState(false);
    const [ showEcosystems, setShowEcosystems ] = useState(false);
    const [ showKnownEnvs, setShowKnownEnvs ] = useState(false);
    const [ showEnvVariables, setShowEnvVariables ] = useState(false);
    const ecosystems = useFetch("/ecosystems", { cache: true });
    const info = useFetch("/info", { cache: true });

    if (!account || account.loading) return <small><i>Loading ...</i></small>

    function toggleShowBuckets() { setShowBuckets(!showBuckets); }
    function toggleShowKnownEnvs() { setShowKnownEnvs(!showKnownEnvs); }
    function toggleShowIdentity() { setShowIdentity(!showIdentity); }
    function toggleShowEcosystem() { setShowEcosystem(!showEcosystem); }
    function toggleShowEcosystems() { setShowEcosystems(!showEcosystems); }
    function toggleShowEnvVariables() { setShowEnvVariables(!showEnvVariables); }

    function awsIamLinkFromArn(arn) {
        const parts = arn?.split("/");
        if (!parts || parts.length <= 0) return "";
        if ((parts.length > 2) && parts[0].includes("assumed-role")) {
            arn = parts[1];
            return `https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/roles/details/${arn}`;
        }
        else {
            arn = parts[parts.length - 1];
            return `https://us-east-1.console.aws.amazon.com/iamv2/home?region=us-east-1#/users/details/${arn}?section=security_credentials`;
        }
    }

    return <table style={{width:"100%"}}><tbody style={{whiteSpace:"nowrap"}}>
        <Row title={account.get("foursight.package") === "foursight" ? "Foursight-Fourfront" : "Foursight-CGAP"} value={account.get("foursight.url")} externalLink={account.get("foursight.url")} small={false}>
            <small style={{marginLeft:"3pt",marginRight:"3pt"}}>|</small>
            <small>
                <a href={`${account.get("foursight.url")}/reactapi/header`} style={{color:"inherit"}} rel="noreferrer" target="_blank">API</a>
                <ExternalLink
                    href={`${account.get("foursight.url")}/reactapi/header`}
                    style={{marginLeft:"4pt"}} />
            </small>
            <SslCertificateLink url={account.get("foursight.url")} />
        </Row>
        <Row title={account.get("foursight.package") === "foursight" ? "Fourfront" : "CGAP-Portal"} value={account.get("portal.url")} externalLink={account.get("portal.url")} small={false}>
            &nbsp;|&nbsp;
            <small><a style={{color:"inherit"}} href={account.get("portal.health_ui_url")} rel="noreferrer" target="_blank">Health</a>&nbsp;</small>
            <small>(<a style={{color:"inherit"}} href={account.get("portal.health_url")} rel="noreferrer" target="_blank">JSON</a>)</small>
            &nbsp;
            <ExternalLink
                href={account.get("portal.health_ui_url")}
                style={{marginLeft:"1pt"}} />
            {account.get("portal.health.indexer") == "true" && <small title={account.get("portal.health.indexer_server")}>
                &nbsp;| <a style={{color:"inherit"}} href={`${account.get("portal.url")}/indexing_status`} rel="noreferrer" target="_blank">Indexer</a>&nbsp;
                <ExternalLink
                    href={`${account.get("portal.url")}/indexing_status?format=json`}
                    style={{marginLeft:"1pt"}} />
            </small> }
            <SslCertificateLink url={account.get("portal.url")} />
        </Row>
        <Row title="Elasticsearch" value={account.get("portal.elasticsearch")?.replace(/:443$/,"")}
             additionalValue={account.get("foursight.es_cluster")}
             externalLink={`https://us-east-1.console.aws.amazon.com/aos/home?region=us-east-1#opensearch/domains/${account.get("foursight.es_cluster") ? account.get("foursight.es_cluster") : ""}`} />
        <Row title="RDS (Foursight)" value={account.get("foursight.rds")}
             externalLink={`https://us-east-1.console.aws.amazon.com/rds/home?region=us-east-1#databases:`}
             show={!account.get("portal.health.database")?.startsWith(account.get("foursight.rds"))} />
        <Row title="RDS" value={account.get("portal.health.database")}
             additionalValue={account.get("foursight.rds_name")}
             externalLink={`https://us-east-1.console.aws.amazon.com/rds/home?region=us-east-1#database:id=${account.get("foursight.rds_name")};is-cluster=false`} />
        <Row title="Redis" value={account.get("foursight.redis_url")}
             externalLink={`https://us-east-1.console.aws.amazon.com/memorydb/home?region=us-east-1#/clusters`} />
        <Row title="SQS" value={account.get("foursight.sqs_url")}
             externalLink={`https://us-east-1.console.aws.amazon.com/sqs/v2/home?region=us-east-1#/queues/${encodeURIComponent(account.get('foursight.sqs_url'))}`} />
        <Separator />
        <Row title={account.get("foursight.identity") == account.get("portal.identity") ? "Identity" : "Foursight Identity"} value={account.get("foursight.identity")}
             externalLink={!isCurrentAccount(header, account) ?
                           `${account.get("foursight.url")}/react/${account.get("foursight.default_env.name")}/aws/infrastructure?secrets=${account.get("foursight.identity")}` :
                           `https://us-east-1.console.aws.amazon.com/secretsmanager/secret?name=${account.get("foursight.identity")}&region=us-east-1#`}>
            <SecretsDropdown header={header} account={account} name={account.get("foursight.identity")} embedded={true} />
        </Row>
        { account.get("foursight.identity") != account.get("portal.identity") && <>
            <Row title="Portal Identity" value={account.get("portal.identity")}
                 externalLink={!isCurrentAccount(header, account) ?
                               `${account.get("foursight.url")}/react/${account.get("foursight.default_env.name")}/aws/infrastructure?secrets=${account.get("portal.identity")}` :
                               `https://us-east-1.console.aws.amazon.com/secretsmanager/secret?name=${account.get("portal.identity")}&region=us-east-1#`}>
                <SecretsDropdown header={header} account={account} name={account.get("portal.identity")} embedded={true} />
            </Row>
        </> }
        <Row title="Stack Name" value={account.get("foursight.stack")}
             externalLink={`https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/stackinfo?filteringStatus=active&viewNested=true&stackId=${account.get("foursight.stack")}`} />
        <Row title="Global Env Bucket" value={account.get("foursight.s3.global_env_bucket")}
             externalLink={`https://s3.console.aws.amazon.com/s3/buckets/${account.get("foursight.s3.global_env_bucket")}?region=us-east-1&tab=objects`}
             tooltip={[`S3 Bucket Org: ${account.get("foursight.s3.bucket_org")}`,`bucket-org-${account.get("foursight.s3.bucket_org")}`]}>
            <small style={{marginLeft:"3pt",marginRight:"3pt"}}>|</small>
            { !showBuckets ? <>
                <span onClick={toggleShowBuckets} className="pointer">Buckets <b>{Char.UpArrow}</b></span>
            </>:<>
                <b onClick={toggleShowBuckets} className="pointer">Buckets {Char.DownArrow}</b>
            </> }
            { isCurrentAccount(header, account) && <>
                &nbsp;|&nbsp;
                { !showEcosystems ? <>
                    <span onClick={toggleShowEcosystems} className="pointer">Ecosystems <b>{Char.UpArrow}</b></span>
                </>:<>
                    <b onClick={toggleShowEcosystems} className="pointer">Ecosystems {Char.DownArrow}</b>
                </> }
            </> }
            { showBuckets && <>
                 <div className="box" style={{background:"inherit",border:"1pt gray dotted",marginTop:"2pt",marginBottom:"2pt",padding:"4pt",color:"inherit"}}>
                    <S3BucketLink name="System" bucket={account.get("foursight.s3.buckets.sys_bucket")} /> 
                    <S3BucketLink name="Output" bucket={account.get("foursight.s3.buckets.outfile_bucket")} />
                    <S3BucketLink name="Metadata" bucket={account.get("foursight.s3.buckets.metadata_bucket")} />
                    <S3BucketLink name="Blobs" bucket={account.get("foursight.s3.buckets.blob_bucket")} />
                    <S3BucketLink name="Raw" bucket={account.get("foursight.s3.buckets.raw_file_bucket")} />
                    <S3BucketLink name="Results" bucket={account.get("foursight.s3.buckets.results_bucket")} /> 
                    <S3BucketLink name="Tibanna CWLs" bucket={account.get("foursight.s3.buckets.tibanna_cwls_bucket")} />
                    <S3BucketLink name="Tibanna Output" bucket={account.get("foursight.s3.buckets.tibanna_output_bucket")} />
                 </div>
            </> }
            { isCurrentAccount(header, account) && <>
                { showEcosystems && <EcosystemsBox bucket={account.get("foursight.s3.global_env_bucket")} /> }
            </> }
        </Row>
        <Row title="S3 Encryption" value={account.get("foursight.s3.has_encryption") ? "Yes" : "No"} showEmpty={true}
             tooltip={[`Controlled by the S3_ENCRYPT_KEY environment variable.`, `tooltip-has-encryption}`]} showEmpty={true}>
        </Row>
        <Row title="S3 Encryption ID" value={account.get("foursight.s3.encrypt_key_id")}
             externalLink={`https://us-east-1.console.aws.amazon.com/kms/home?region=us-east-1#/kms/keys/${account.get("foursight.s3.encrypt_key_id")}`}
             tooltip={[`S3 encryption key ID from the ENCODED_S3_ENCRYPT_KEY_ID environment variable.`,
                       `tooltip-encryption-key-${account.get("foursight.aws_account_number")}`]} showEmpty={true}>
        </Row>
        <Row title="S3 Access Key" value={account.get("foursight.s3.access_key")}
             tooltip={[`From the S3_AWS_ACCESS_KEY_ID environment variable.`,
                       `tooltip-s3-aws-access-key-id${account.get("foursight.s3.access_key")}`]}>
            &nbsp;
            { account.get("foursight.s3.access_key_error") ? <>
                <b style={{color:"red"}}>{Char.X}</b>
            </>:<>
                <b style={{color:"green"}}>{Char.Check}</b>
            </> }
        </Row>
        <Separator />
        <Row title="AWS Account" value={account.get("foursight.aws_account_number")} additionalValue={account.get("foursight.aws_account_name")} externalLink={"https://us-east-1.console.aws.amazon.com/billing/home#/account"} bold={true}>
            &nbsp;|&nbsp;Access Key: <span id="tooltip-aws-access-key">{header?.app?.credentials?.aws_access_key_id}</span>
                <Tooltip id={"tooltip-aws-access-key"} text={`From the AWS_ACCESS_KEY_ID environment variable.`} position="bottom" />
                <span id="tooltip-aws-user-arn">
                <ExternalLink
                    href={awsIamLinkFromArn(info.data?.app?.credentials?.aws_user_arn)}
                    style={{marginLeft:"4pt"}} />
                </span>
                <Tooltip id={"tooltip-aws-user-arn"} text={`Associated IAM ARN: ${info.data?.app?.credentials?.aws_user_arn}`} position="bottom" />
        </Row>
        <Row title="Environment" value={`Default: ${account.get("foursight.default_env.full_name")}`} additionalValue={account.get("foursight.env_count") ? `${account.get("foursight.env_count")} total` : ""}>
            { isCurrentAccount(header, account) && <>
                &nbsp;|&nbsp;
                { !showKnownEnvs ? <>
                    <span onClick={toggleShowKnownEnvs} className="pointer">Environments <b>{Char.UpArrow}</b></span>
                </>:<>
                    <b onClick={toggleShowKnownEnvs} className="pointer">Environments {Char.DownArrow}</b>
                </> }
                &nbsp;|&nbsp;
                { !showEnvVariables ? <span id={`tooltip-envvar`}>
                    <span onClick={toggleShowEnvVariables} className="pointer">Variables <b>{Char.UpArrow}</b></span>
                </span>:<span>
                    <b onClick={toggleShowEnvVariables} className="pointer">Variables {Char.DownArrow}</b>
                </span> }
                <Tooltip id={`tooltip-envvar`} text={`Environment variable values.`} position="top" />
                &nbsp;|&nbsp;
                { !showEcosystem ? <>
                    { ecosystems.data?.current ?
                        <span onClick={toggleShowEcosystem} className="pointer">Ecosystem: {ecosystems.data?.current?.replace(".ecosystem", "")}&nbsp;<b>{Char.UpArrow}</b></span>
                    :   <span onClick={toggleShowEcosystem} className="pointer">Ecosystem&nbsp;<b>{Char.UpArrow}</b></span> }
                </>:<>
                    { ecosystems.data?.current ?
                        <b onClick={toggleShowEcosystem} className="pointer">Ecosystem: {ecosystems.data?.current?.replace(".ecosystem", "")}&nbsp;<b>{Char.DownArrow}</b></b>
                    :   <b onClick={toggleShowEcosystem} className="pointer">Ecosystem&nbsp;<b>{Char.DownArrow}</b></b> }
                </> }
                <ExternalLink href={`https://s3.console.aws.amazon.com/s3/object/${account.get('foursight.s3.global_env_bucket')}?region=us-east-1&prefix=${ecosystems.data?.current}`} style={{marginLeft:"4pt",position:"relative",bottom:"-1px"}} />
                { showKnownEnvs && <> <KnownEnvsBox header={header} account={account} /> </>}
                { showEcosystem && <EcosystemBox bucket={account.get("foursight.s3.global_env_bucket")} /> }
                { showEnvVariables && <> <EnvVariablesBox header={header} account={account} /> </>}
            </> }
        </Row>
        <Row title="Auth0 Client ID" value={account.get("foursight.auth0_client")} externalLink={`${account.get("foursight.url")}/reactapi/auth0_config`}>
            &nbsp;|&nbsp;
            <a style={{color:"inherit"}} href={`${account.get("portal.url")}/auth0_config`} rel="noreferrer" target="_blank">Portal</a>
            <ExternalLink
                href={`${account.get("portal.url")}/auth0_config?format=json`}
                style={{marginLeft:"4pt"}} />
        </Row>
        <Row title="reCAPTCHA Key ID" value={account.get("foursight.re_captcha_key")} />
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Portal Access Key:
            </td>
            <td>
                { isCurrentAccount(header, account) && !portalAccessKey.loading && <>
                    {portalAccessKey.get("key")}&nbsp;|&nbsp;
                </> }
                <PortalAccessKeyStatus portalAccessKeyResponse={account.get("foursight.portal_access_key")} />
                <ExternalLink
                    href={`${account.get("foursight.url")}/react/${account.get("foursight.default_env.name")}/portal_access_key`}
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
        <Separator />
        <Row title="Foursight Deployed" value={`${DateTime.Format(account.get("foursight.deployed"))} ${Char.RightArrow} ${Time.Ago(account.get("foursight.deployed"), true, false)}`} show={account.get("foursight.deployed") ? true : false} />
        <Row title="Portal Deployed" value={`${DateTime.Format(account.get("portal.started"))} ${Char.RightArrow} ${Time.Ago(account.get("portal.started"), true, false)}`} />
    </tbody></table>
}

const AccountInfoRight = ({ account, header }) => {
    if (!account || account.loading) return <></>
    return <table style={{width:"100%",margin:"0",padding:"0"}}><tbody style={{fontSize:"small",verticalAlign:"top",whiteSpace:"nowrap"}}>
        <VersionRow title={account.get("foursight.package")} version={account.get("foursight.versions.foursight")} />
        <VersionRow title="foursight-core" version={account.get("foursight.versions.foursight_core")} />
        <VersionRow title="dcicutils" version={account.get("foursight.versions.dcicutils")} />
        <VersionRow title="tibanna" version={account.get("foursight.versions.tibanna")} />
        <VersionRow title="tibanna_ff" version={account.get("foursight.versions.tibanna_ff")} />
        <VersionRow title="boto3" version={account.get("foursight.versions.boto3")} />
        <VersionRow title="botocore" version={account.get("foursight.versions.botocore")} />
        <VersionRow title="chalice" version={account.get("foursight.versions.chalice")} />
        <VersionRow title="redis" version={account.get("foursight.versions.redis")} using={account.get("foursight.redis_running")} />
        <VersionRow title="python" version={account.get("foursight.versions.python")} />
        <Separator />
        <VersionRow title="portal" version={account.get("portal.versions.portal")} />
        <VersionRow title="portal-project" version={account.get("portal.health.project_version")} show={account.get("portal.health.project_version") != account.get("portal.versions.portal")}/>
        <VersionRow title="snovault" version={account.get("portal.versions.snovault")} />
        <VersionRow title="dcicutils" version={account.get("portal.versions.dcicutils")} />
        <VersionRow title="python" version={account.get("portal.health.python_version")} />
        <Separator />
        <VersionRow title="elasticsearch-server" version={account.get("foursight.versions.elasticsearch_server")} />
        <VersionRow title="elasticsearch" version={account.get("foursight.versions.elasticsearch")} />
        <VersionRow title="elasticsearch-dsl" version={account.get("foursight.versions.elasticsearch_dsl")} />
        <VersionRow title="redis-server" version={account.get("foursight.versions.redis_server")} />
    </tbody></table>
}

export const AccountInfoCurrent = ({ bg = null, top = null }) => {
    const header = useHeader();
    const account = {
        id: "current",
        name: "current",
        stage: header.app?.stage
    }
    return <AccountInfo account={account} header={header} decrementAccountCount={() => {}} all={true} bg={bg} brighten={true} top={top} />
}

export const AccountInfo = ({ account, header, foursightUrl, all, decrementAccountCount, brighten, bg = null, top = null }) => {

    const accounts = useFetch(`/accounts/${account.id}`, { onDone: () => decrementAccountCount(), cache: true, nofetch: true });

    useEffect(() => {
        fetchData();
    }, []);

    function fetchData() {
        accounts.fetch();
    }

    function refreshData() {
        accounts.refresh();
    }

    function isCurrentAccountAndStage(header, account) {
        return isCurrentAccount(header, account) &&
               ((header?.app?.stage === account?.data?.stage) ||
                (header?.app?.stage === account?.stage));
    }

    let boxStyle = {
        marginTop: top ? top : "4pt",
        marginBottom: "8pt",
        filter:brighten ? "brightness(1.1)" : ""
    };
    if (bg) boxStyle = { background: bg, ...boxStyle };

    if (!all && !isCurrentAccount(header, account)) return null;
    return <>
        <div className={isCurrentAccount(header, accounts) ? "box" : "box lighten"} style={boxStyle}>
            {isCurrentAccountAndStage(header, accounts) ? <>
                <b id={`tooltip-current-${account.name}-${accounts?.data?.stage}`}>{accounts.data?.name || account.name}</b>
                <Tooltip id={`tooltip-current-${account.name}-${accounts?.data?.stage}`} text={`This is your current AWS account: ${accounts.get("foursight.aws_account_number")}`} position="top" />
            </>:<>
                <b id={`tooltip-account-${account.name}-${account.stage}`}>{accounts.data?.name || account.name}</b>
                <Tooltip id={`tooltip-account-${account.name}-${account.stage}`} text={`AWS Account: ${accounts.get("foursight.aws_account_number")}.`} position="top" />
            </>}
            { accounts.get("foursight.stage") ? <>
                &nbsp;&nbsp;<b>&ndash;</b>&nbsp;&nbsp;<span id={`tooltip-stage-${account.id}-${accounts.get("foursight.stage")}`}>{accounts.get("foursight.stage")}</span>
                <Tooltip id={`tooltip-stage-${account.id}-${accounts.get("foursight.stage")}`} text={`Stage: ${accounts.get("foursight.stage")}`} position="top" />
            </>:<>
                { account.stage && <>
                    &nbsp;&nbsp;<b>&ndash;</b>&nbsp;&nbsp;<span id={`tooltip-stage-${account.id}-${account.stage}`}>{account.stage}</span>
                    <Tooltip id={`tooltip-stage-${account.id}-${account.stage}`} text={`Stage: ${account.stage}`} position="top" />
                </>}
            </>}
            { isCurrentAccountAndStage(header, accounts) && <>&nbsp;&nbsp;{Char.Star}</> }
            <div style={{float:"right",marginTop:"-2pt"}}>
                { accounts.loading ? <>
                    <div style={{paddingTop:"7pt",paddingRight:"2pt"}}><BarSpinner /></div>
                </>:<>
                    { accounts.data?.__showraw ? <>
                        <span id={`tooltip-hide-raw-${account.id}`} onClick={() => { accounts.data.__showraw = false; accounts.update(); }} style={{cursor:"pointer"}}>{Char.DownArrow}</span>
                        <Tooltip id={`tooltip-hide-raw-${account.id}`} text={"Click to hide raw result."} position="top" />
                    </>:<>
                        <span id={`tooltip-show-raw-${account.id}`} onClick={() => {accounts.data.__showraw = true;accounts.update(); }} style={{cursor:"pointer"}}>{Char.UpArrow}</span>
                        <Tooltip id={`tooltip-show-raw-${account.id}`} text={"Click to show raw result."} position="top" />
                    </>}
                    <span onClick={refreshData} style={{cursor:"pointer"}}>&nbsp;&nbsp;{Char.Refresh}</span>
                </>}
            </div>
            <div style={{marginTop:"3pt",marginBottom:"4pt",border:"1px",borderTop:"dotted"}}></div>
            <table><tbody>
                <tr style={{verticalAlign:"top"}}>
                    <td style={{width:"80%"}}>
                        <AccountInfoLeft header={header} account={accounts} foursightUrl={foursightUrl} />
                    </td>
                    <td style={{paddingLeft:"6pt",width:"12pt"}} />
                    <td style={{marginLeft:"12pt",borderLeft:`${accounts.loading ? "0" : "1"}px solid`}} />
                    <td style={{width:"30%",paddingLeft:"8pt",textAlign:"top",verticalAlign:"top"}}>
                        <AccountInfoRight account={accounts} header={header} />
                    </td>
                </tr>
            </tbody></table>
            { accounts.data?.__showraw && <>
                <div style={{marginTop:"8pt",marginBottom:"8pt",border:"1px",borderTop:"solid"}}></div>
                <pre style={{background:"inherit"}}>
                    {Yaml.Format(accounts.data)}
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

const EcosystemBox = () => {
    const info = useFetch("/info", { cache: true });
    const ecosystems = useFetch("/ecosystems", { cache: true });
    const currentEcosystemName = !ecosystems.loading ? ecosystems?.data["current"] : null;
    return <>
        <pre className="box" style={{background:"inherit",border:"1pt gray dotted",marginTop:"2pt",marginBottom:"2pt",padding:"6pt",color:"inherit"}}>
            { info.loading ? <>
                <StandardSpinner label="Loading ecosystem info" />
            </>:<>
                {Yaml.Format(info.data.buckets.ecosystem)}
            </> }
        </pre>
    </>
}

const EcosystemsBox = ({ bucket }) => {
    let ecosystems = useFetch("/ecosystems", { cache: true });
    const style={background:"inherit", border:"1pt gray dotted", marginTop:"2pt", marginBottom:"2pt", padding:"6pt", color:"inherit"};
    if (ecosystems.loading) {
        return <pre className="box" style={style}>
            <StandardSpinner label="Loading ecosystems info" />
        </pre>
    }
    ecosystems.data = { ...ecosystems.data };
    const currentEcosystemName = ecosystems.data["current"];
    let currentEcosystemData = null;
    if (Str.HasValue(currentEcosystemName)) {
        delete ecosystems.data["current"];
        currentEcosystemData = ecosystems.data[currentEcosystemName];;
        delete ecosystems.data[currentEcosystemName];
    }
    return <>
            { currentEcosystemData &&
                <pre className="box" style={style} key={currentEcosystemName}>
                    <b><u>{currentEcosystemName}</u></b><ExternalLink href={`https://s3.console.aws.amazon.com/s3/object/${bucket}?region=us-east-1&prefix=${currentEcosystemName}`} style={{marginLeft:"6pt"}} />&nbsp;(<i>current</i>)<p />
                    {Yaml.Format(currentEcosystemData)}
                </pre>
            }
            { Object.keys(ecosystems.data).map((ecosystemName, index) => {
                const ecosystemData = ecosystems.data[ecosystemName];
                return <pre className="box" style={style} key={ecosystemName}>
                    <b><u>{ecosystemName}</u></b><ExternalLink href={`https://s3.console.aws.amazon.com/s3/object/${bucket}?region=us-east-1&prefix=${ecosystemName}`} style={{marginLeft:"6pt"}} /><p />
                    {Yaml.Format(ecosystemData)}
                </pre>
            })}
    </>
}

const EnvVariablesBox = () => {
    let info = useFetch("/info", { cache: true });
    function isRedacted(s) { return /^\*+$/.test(s); }
    return <pre style={{background:"inherit",border:"1pt gray dotted",marginTop:"4pt",width:"524pt"}}>
        { info.loading ? <>
            <StandardSpinner label="Loading environment variables" style={{paddingBottom:"0pt"}} />
        </>:<>
            <ul style={{marginBottom:"1pt"}}>
                { Object.keys(info?.data?.environ)?.map(name => <li key={name}>
                    <b>{name}</b> <br />
                    { isRedacted(info.data.environ[name]) ? <span style={{color:"red"}}>REDACTED</span> : info.data.environ[name] }
                </li>)}
            </ul>
        </> }
    </pre>
}

export default AccountsComponent;
