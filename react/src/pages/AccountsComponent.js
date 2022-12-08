import React, { useEffect, useState } from 'react';
import { BarSpinner, StandardSpinner } from '../Spinners';
import { useSearchParams } from 'react-router-dom';
import Char from '../utils/Char';
import { useFetch } from '../utils/Fetch';
import Server from '../utils/Server';
import Styles from '../Styles';
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
                    <b className="tool-tip" data-text={Time.Ago(info.get("foursight.deployed"))}>{info.get("foursight.deployed")}</b> &ndash; {Time.Ago(info.get("foursight.deployed"))}
                </>:<>{Char.EmptySet}</>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                Portal Deployed:
            </td>
            <td>
                { info.get("portal.started") ? <>
                    <b className="tool-tip" data-text={Time.Ago(info.get("portal.started"))}>{info.get("portal.started")}</b> &ndash; {Time.Ago(info.get("portal.started"))}
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

const AccountInfo = ({ account, header, all, decrementAccountCount }) => {

    const info = useFetch(Server.Url(`/accounts_from_s3/${account.id}`), { cache: true, nofetch: true });

    useEffect(() => {
        refreshData();
    }, []);

    function refreshData() {
        info.refresh({ onDone: () => decrementAccountCount()});
    }

    function isCurrentAccount(info) {
        if (!Type.IsNull(header?.app?.credentials?.aws_account_number) &&
            !Type.IsNull(info?.data?.foursight?.aws_account_number) &&
            (header?.app?.credentials?.aws_account_number === info?.data?.foursight?.aws_account_number)) {
                return true;
        }
        return false;
    }

    function isCurrentAccountAndStage(info) {
        return isCurrentAccount(info) && (header?.app?.stage === info?.data?.stage);
    }

    if (!all && !isCurrentAccount(info)) return null;
    return <>
        <div className={isCurrentAccountAndStage(info) ? "box" : "box lighten"} style={{marginTop:"4pt",marginBottom:"8pt"}}>
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

    const [ args, setArgs ] = useSearchParams();
    const argsAll = args.get("all");
    const [ all, setAll ] = useState(argsAll?.toLowerCase() === "true" || argsAll === "1" ? true : false);
    const accounts = useFetch(Server.Url("/accounts_from_s3"));
    const [ accountCount, setAccountCount ] = useState(0);
    const [ startup, setStartup ] = useState(true);

    useEffect(() => {
        refreshAll();
    }, []);

    function refreshAll() {
        accounts.update(null);
        accounts.fetch(Server.Url("/accounts_from_s3"), { onDone: (response) => { setAccountCount(response.data?.length) }});
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
            <div style={{marginTop:"0pt"}}><b className="tool-tip" data-text={header?.app?.accounts_file_from_s3}>Known Accounts</b>
                <div style={{float:"right",display:"inline",fontSize:"small",marginRight:"4pt",marginTop:"0pt"}}>
                { (all)  ? <>
                    <span className="tool-tip" data-text={"Click to show only local accounts/stages."} style={{cursor:"pointer"}} onClick={toggleAll}>Local</span>&nbsp;|&nbsp;
                    <b style={{cursor:"pointer"}} onClick={toggleAll}>All</b>
                </>:<>
                    <b style={{cursor:"pointer"}} onClick={toggleAll}>Local</b>&nbsp;|&nbsp;
                    <span className="tool-tip" data-text={"Click to show all known accounts."} style={{cursor:"pointer"}} onClick={toggleAll}>All</span>
                </>}
                &nbsp;|&nbsp; <span style={{cursor:"pointer"}} onClick={refreshAll}>{Char.Refresh}</span>
                </div>
            </div>
        </div>
        { accounts.length > 0 ? <>
            { accounts?.map((account, index) => <React.Fragment key={account.id}>
                <AccountInfo account={account} header={header} all={all} decrementAccountCount={decrementAccountCount} />
            </React.Fragment>)}
            { (startup || (accountCount > 0)) && <>
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
