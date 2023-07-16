import React from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StandardSpinner } from '../../Spinners';
import useFetch from '../../hooks/Fetch';
import { ExternalLink } from '../../Components';
import Char from '../../utils/Char';
import { HorizontalLine } from '../../Components';
import Type from '../../utils/Type';
import Str from '../../utils/Str';
import Yaml from '../../utils/Yaml';
import useSelectedComponents from '../../hooks/SelectedComponents';
import useKeyedState from '../../hooks/KeyedState';
import useUrlArgs from '../../hooks/UrlArgs';

const tdLabelStyle = {
    color: "var(--box-fg)",
    fontWeight: "bold",
    paddingTop: "1pt",
    verticalAlign: "top",
    width: "5%",
    paddingRight: "8pt",
    whiteSpace: "nowrap"
}
const tdContentStyle = {
    verticalAlign: "top",
}

function isRedacted(s) {
    return /^\*+$/.test(s);
}

export const SecretNameList = (props) => {
    const secretNames = useFetch("/aws/secrets", { cache: true });
    return <>
        <div><b>AWS Secrets</b></div>
        <div className="box" style={{whiteSpace:"nowrap",marginBottom:"6pt"}}>
            { secretNames.loading && <StandardSpinner label="Loading secrets" /> }
            { secretNames.map((secretName, i) => {
                const toggleSecrets = () => props.toggleSecrets(secretName);
                const selectedSecrets = () => props.selectedSecrets(secretName);
                const style = {...(selectedSecrets(secretName) ? {fontWeight:"bold"} : {})};
                return <>
                    <div key={secretName} style={style} className="pointer" onClick={toggleSecrets}>{secretName}</div>
                    <HorizontalLine top="2pt" bottom="2pt" iff={i + 1 < secretNames.length} />
                </>
            }) }
        </div>
    </>
}

export const Gac = (props) => {
    const info = useFetch("/info", { cache: true });
    return <SecretsView name={info.data?.gac?.name} values={info.data?.gac?.values} hide={props.hide} />
}

export const Secrets = (props) => {
    const values = useFetch(props.name ? `/aws/secrets/${props.name}` : null, { cache: false });
    return props.name ? <SecretsView name={props.name} values={values?.data} hide={props.hide} embedded={props.embedded} /> : null;
}

export const SecretsView = (props) => {
    return <div style={{maxWidth:"100%",marginBottom:props.embedded ? "2pt" : "8pt"}}>
        { !props.embedded &&
            <div style={{wordBreak:"break-all"}}><b>Secrets</b>:&nbsp;<b>{props.name}</b>&nbsp;
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/secretsmanager/secret?name=${props.name}&region=us-east-1`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
                    <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={props.hide}>{Char.X}</b>
            </div>
        }
        <div className="box margin" style={{border:props.embedded ? "1px gray dotted" : "",background:props.embedded ? "inherit" : "",color:"inherit"}}>
            { !props.values ?
                <div style={{marginTop:"-1pt"}} ><StandardSpinner label="Loading secrets" /></div>
            : 
                <ul style={{marginBottom:"1pt"}}>
                    { Object.keys(props.values)?.map(name => <li key={name}>
                        <b>{name}</b> <br />
                        { isRedacted(props.values[name]) ? <span style={{color:"red"}}>REDACTED</span> : props.values[name] }
                    </li>)}
                </ul>
            }
        </div>
    </div>
}
