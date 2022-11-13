import { useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Uuid from 'react-uuid';
import HeaderData from '../HeaderData';
import Page from '../Page';
import Auth from '../utils/Auth';
import Client from '../utils/Client';
import { HorizontalLine } from '../Components';
import Char from '../utils/Char';
import Env from '../utils/Env';
import { useFetch, useFetchFunction } from '../utils/Fetch';
import Server from '../utils/Server';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

const AccountInfoLeft = ({ info }) => {
    return <table style={{width:"100%"}}><tbody style={{whiteSpace:"nowrap"}}>
        <tr>
            <td style={{paddingRight:"10pt",width:"10%"}}>
                Foursight:
            </td>
            <td>
                <a style={{color:"inherit"}} href={info.get("foursight.url")} target="_blank">{info.get("foursight.url")}</a>
                &nbsp;
                <a style={{color:"inherit"}} href={info.get("foursight.url")} target="_blank">
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
                    <a style={{color:"inherit"}} href={info.get("portal.url")} target="_blank">{info.get("portal.url")}</a>
                    &nbsp;
                    <a style={{color:"inherit"}} href={info.get("portal.url")} target="_blank">
                        <span className="fa fa-external-link" style={{position:"relative",bottom:"-1px"}}></span>
                    </a>
                </>:<> {Char.EmptySet} </>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                ElasticSearch:
            </td>
            <td>
                { info.get("portal.elasticsearch") ? <>
                    {info.get("portal.elasticsearch")}
                </>:<> {Char.EmptySet} </>}
            </td>
        </tr>
        <tr style={{fontSize:"small"}}>
            <td style={{paddingRight:"10pt"}}>
                Database:
            </td>
            <td>
                { info.get("portal.health.database") ? <>
                    {info.get("portal.health.database")}
                </>:<> {Char.EmptySet} </>}
            </td>
        </tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr>
            <td style={{paddingRight:"10pt"}}>
                Identity:
            </td>
            <td>
                { info.get("foursight.identity") ? <>
                    {info.get("foursight.identity")}
                </>:<> {Char.EmptySet} </>}
            </td>
        </tr>
        <tr>
            <td style={{paddingRight:"10pt"}}>
                Global Env Bucket:
            </td>
            <td>
                { info.get("foursight.s3.global_env_bucket") ? <>
                    {info.get("foursight.s3.global_env_bucket")}
                    { info.get("foursight.s3.bucket_org") && <>
                        &nbsp;(<span className="tool-tip" data-text={`S3 Bucket Org: ${info.get("foursight.s3.bucket_org")}`}>{info.get("foursight.s3.bucket_org")}</span>)
                    </>}
                </>:<> {Char.EmptySet} </>}
            </td>
        </tr>
        <tr>
            <td style={{paddingRight:"10pt"}}>
                Default Env:
            </td>
            <td>
                { info.get("foursight.default_env.name") ? <>
                    {info.get("foursight.default_env.name")}
                    { info.get("foursight.env_count") > 1 &&
                        <span>&nbsp;({info.get("foursight.env_count")} total)</span>
                    }
                </>:<> {Char.EmptySet} </>}
            </td>
        </tr>
        <tr>
            <td style={{paddingRight:"10pt"}}>
                AWS Account:
            </td>
            <td>
                { info.get("foursight.aws_account_number") ? <>
                    <b>{info.get("foursight.aws_account_number")}</b>
                    { info.get("foursight.aws_account_name") && <>
                        &nbsp;(<span className="tool-tip" data-text={`AWS Account Alias: ${info.get("foursight.aws_account_name")}`}>{info.get("foursight.aws_account_name")}</span>)
                    </>}
                </>:<> {Char.EmptySet} </>}
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
                </>:<> {Char.EmptySet} </>}
            </td>
        </tr>
    </tbody></table>
}

const AccountInfoRight = ({ info }) => {
    return <table style={{width:"100%",margin:"0",padding:"0"}}><tbody style={{fontSize:"small",verticalAlign:"top",whiteSpace:"nowrap"}}>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt",width:"10%"}}>
                Foursight Deployed:
            </td>
            <td>
                { info.get("foursight.deployed") ? <>
                    <b>{info.get("foursight.deployed")}</b>
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                Portal Deployed:
            </td>
            <td>
                { info.get("portal.started") ? <>
                    <b>{info.get("portal.started")}</b>
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
            </td>
        </tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr><td colSpan="2" style={{borderTop:"1px dotted"}} /></tr>
        <tr><td style={{paddingTop:"4pt"}} /></tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                foursight-core:
            </td>
            <td>
                <b>{info.get("foursight.versions.foursight_core")}</b>
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                { info.get("foursight.package") === "foursight" ? <>
                    foursight:
                </>:<>
                    foursight-cgap:
                </>}
            </td>
            <td>
                {info.get("foursight.versions.foursight") ? <>
                    <b>{info.get("foursight.versions.foursight")}</b>
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                foursight-dcicutils:
            </td>
            <td>
                {info.get("foursight.versions.dcicutils") ? <>
                    <b>{info.get("foursight.versions.dcicutils")}</b>
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                foursight-python:
            </td>
            <td>
                {info.get("foursight.versions.python") ? <>
                    <b>{info.get("foursight.versions.python")}</b>
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
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
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                snovault:
            </td>
            <td>
                {info.get("portal.versions.snovault") ? <>
                    <b>{info.get("portal.versions.snovault")}</b>
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                portal-dcicutils:
            </td>
            <td>
                {info.get("portal.versions.dcicutils") ? <>
                    <b>{info.get("portal.versions.dcicutils")}</b>
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
            </td>
        </tr>
        <tr>
            <td style={{whiteSpace:"nowrap",paddingRight:"4pt"}}>
                portal-python:
            </td>
            <td>
                {info.get("portal.health.python_version") ? <>
                    <b>{info.get("portal.health.python_version")}</b>
                </>:<>
                    <b>{Char.EmptySet}</b>
                </>}
            </td>
        </tr>
    </tbody></table>
}

const AccountInfo = ({ account }) => {
    const info = useFetch(Server.Url(`/accounts/${account.id}`, false), { nofetch: false });
    return <>
        <div className="box lighten">
            <b>{info.data?.name}</b>
            { info.get("foursight.stage") && <>
                &nbsp;- <span className="tool-tip" data-text={`Stage: ${info.get("foursight.stage")}`}>{info.get("foursight.stage")}</span>
            </>}
            <div style={{float:"right"}}>
                { info.data?.__showraw ? <>
                    <span className="tool-tip" data-text="Click to hide raw results." onClick={() => { info.data.__showraw = false; info.update(); }} style={{cursor:"pointer"}}>{Char.DownArrow}</span>
                </>:<>
                    <span className="tool-tip" data-text="Click to show raw results." onClick={() => {info.data.__showraw = true;info.update(); }} style={{cursor:"pointer"}}>{Char.UpArrow}</span>
                </>}
            </div>
            <div style={{marginTop:"3pt",marginBottom:"4pt",border:"1px",borderTop:"dotted"}}></div>
            <table><tbody>
                <tr>
                    <td style={{width:"70%"}}>
                        <AccountInfoLeft info={info} />
                    </td>
                    <td style={{paddingLeft:"10pt",width:"12pt"}} />
                    <td style={{marginLeft:"12pt",borderLeft:"1px solid"}} />
                    <td style={{width:"30%",paddingLeft:"12pt",textAlign:"top",verticalAlign:"top"}}>
                        <AccountInfoRight info={info} />
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

const AccountsComponent = () => {
    const accounts = useFetch(Server.Url("/accounts", false));
    return <>
        { accounts?.map(account => <>
            <div style={{height:"8pt"}} />
            <AccountInfo account={account} />
        </>)}
    </>
}

export default AccountsComponent;
