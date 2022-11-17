import React, { useEffect, useState } from 'react';
import { BarSpinner } from '../Spinners';
import Char from '../utils/Char';
import { useFetch } from '../utils/Fetch';
import Server from '../utils/Server';
import Time from '../utils/Time';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

const AccountInfoLeft = ({ info }) => {
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
                <a style={{color:"inherit"}} href={info.get("foursight.url")} rel="noreferrer" target="_blank">{info.get("foursight.url")}</a>
                &nbsp;
                <a style={{color:"inherit"}} href={info.get("foursight.url")} rel="noreferrer" target="_blank">
                    <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px"}}></span>
                </a>
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
                    <a style={{color:"inherit"}} href={info.get("portal.health_ui_url")} rel="noreferrer" target="_blank"><span className="fa fa-external-link" style={{position:"relative",bottom:"-1px"}}></span></a>
                        &nbsp;
                        <small>
                            (<a style={{color:"inherit"}} href={info.get("portal.health_url")} rel="noreferrer" target="_blank">JSON</a>)&nbsp;
                        </small>
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
                Database:
            </td>
            <td>
                { info.get("portal.health.database") ? <>
                    {info.get("portal.health.database")}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
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
                        &nbsp;(<span className="tool-tip" data-text={`S3 Bucket Org: ${info.get("foursight.s3.bucket_org")}`}>{info.get("foursight.s3.bucket_org")}</span>)
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
                    <span className="tool-tip" data-text="S3 Encryption Key ID.">{info.get("foursight.s3.encrypt_key_id")}</span>
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
                        &nbsp;(<span className="tool-tip" data-text={`AWS Account Alias: ${info.get("foursight.aws_account_name")}`}>{info.get("foursight.aws_account_name")}</span>)
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
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr style={{fontSize:"small"}}>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt",width:"10%"}}>
                Foursight Deployed:
            </td>
            <td>
                { info.get("foursight.deployed") ? <>
                    <b className="tool-tip" data-text={Time.Ago(info.get("foursight.deployed"))}>{info.get("foursight.deployed")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                Portal Deployed:
            </td>
            <td>
                { info.get("portal.started") ? <>
                    <b className="tool-tip" data-text={Time.Ago(info.get("portal.started"))}>{info.get("portal.started")}</b>
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
    </tbody></table>
}

const AccountInfoRight = ({ info }) => {
    return <table style={{width:"100%",margin:"0",padding:"0"}}><tbody style={{fontSize:"small",verticalAlign:"top",whiteSpace:"nowrap"}}>
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
                chalice:
            </td>
            <td>
                {info.get("foursight.versions.chalice") ? <>
                    <b>{info.get("foursight.versions.chalice")}</b>
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
                foursight-python:
            </td>
            <td>
                {info.get("foursight.versions.python") ? <>
                    <b>{info.get("foursight.versions.python")}</b>
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
                snovault:
            </td>
            <td>
                {info.get("portal.versions.snovault") ? <>
                    <b>{info.get("portal.versions.snovault")}</b>
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
    </tbody></table>
}

const AccountInfo = ({ account, header, refresh, setRefresh }) => {

    const info = useFetch(Server.Url(`/accounts/${account.id}`, false), { nofetch: true });

    useEffect(() => {
        info.refresh();
        setRefresh(false);
    }, [ refresh ]);

    function refreshData() {
        info.refresh();
    }

    function isCurrentAccount(info) {
        if (!Type.IsNull(header?.app?.credentials?.aws_account_number) &&
            !Type.IsNull(info?.data?.foursight?.aws_account_number) &&
            (header?.app?.credentials?.aws_account_number === info?.data?.foursight?.aws_account_number)) {
                return true;
        }
        return false;
    }

    return <>
        <div className={isCurrentAccount(info) ? "box" : "box lighten"}>
            {isCurrentAccount(info) ? <>
                <b className="tool-tip" data-text="This is your current account.">{info.data?.name || account.name}</b>
            </>:<>
                <b>{info.data?.name || account.name}</b>
            </>}
            { info.get("foursight.stage") ? <>
                &nbsp;&nbsp;&mdash;&nbsp;&nbsp;<span className="tool-tip" data-text={`Stage: ${info.get("foursight.stage")}`}>{info.get("foursight.stage")}</span>
            </>:<>
                { account.stage && <>
                    &nbsp;&nbsp;&mdash;&nbsp;&nbsp;<span className="tool-tip" data-text={`Stage: ${account.stage}`}>{account.stage}</span>
                </>}
            </>}
            <div style={{float:"right",marginTop:"-2pt"}}>
                { info.loading ? <>
                    <div style={{paddingTop:"7pt",paddingRight:"2pt"}}><BarSpinner /></div>
                </>:<>
                    { info.data?.__showraw ? <>
                        <span className="tool-tip" data-text="Click to hide raw results." onClick={() => { info.data.__showraw = false; info.update(); }} style={{cursor:"pointer"}}>{Char.DownArrow}</span>
                    </>:<>
                        <span className="tool-tip" data-text="Click to show raw results." onClick={() => {info.data.__showraw = true;info.update(); }} style={{cursor:"pointer"}}>{Char.UpArrow}</span>
                    </>}
                    <span onClick={refreshData} style={{cursor:"pointer"}}>&nbsp;&nbsp;{Char.Refresh}</span>
                </>}
            </div>
            <div style={{marginTop:"3pt",marginBottom:"4pt",border:"1px",borderTop:"dotted"}}></div>
            <table><tbody>
                <tr style={{verticalAlign:"top"}}>
                    <td style={{width:"70%"}}>
                        <AccountInfoLeft info={info} header={header} />
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

    const accounts = useFetch(Server.Url("/accounts", false));
    const [ refresh, setRefresh ] = useState(false);

    function refreshAll() {
        accounts.refresh();
        setRefresh(true);
    }

    return <>
        <b>Known Accounts</b>
        { header?.app?.accounts && <>
             <small>&nbsp;&nbsp;&ndash;&nbsp;&nbsp;{header?.app?.accounts}</small>
        </>}
        { accounts.length > 0 ? <>
            <span style={{float:"right",marginRight:"10pt",cursor:"pointer"}} onClick={refreshAll}>
                &nbsp;{Char.Refresh}
            </span>
            { accounts?.map((account, index) => <React.Fragment key={index}>
                { index > 0 && <div style={{height:"8pt"}} /> }
                <AccountInfo account={account} header={header} refresh={refresh} setRefresh={setRefresh}/>
            </React.Fragment>)}
        </>:<>
            <div className="box">
                Not supported.
            </div>
        </>}
    </>
}

export default AccountsComponent;
