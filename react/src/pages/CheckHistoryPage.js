import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import { FetchErrorBox } from '../Components';
import { StandardSpinner } from '../Spinners';
import PaginationComponent from '../PaginationComponent';
import Char from '../utils/Char';
import Clipboard from '../utils/Clipboard';
import Client from '../utils/Client';
import Env from '../utils/Env';
import Image from '../utils/Image';
import Json from '../utils/Json';
import Server from '../utils/Server';
import Str from '../utils/Str';
import Styles from '../Styles';
import TableHead from '../TableHead';
import Time from '../utils/Time';
import Tooltip from '../components/Tooltip';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';
import { CheckBoxWithFetch } from './checks/CheckBox';

function basename(path) {
    return path?.split('/')?.reverse()[0];
}

function dirname(path) {
    return path?.substring(0, path?.lastIndexOf("/"));
}

const CheckHistoryPage = (props) => {

    const { environ, check } = useParams();
    const [ args, setArgs ] = useSearchParams();

    const [ limit, setLimit ] = useState(parseInt(args.get("limit")) || 25);
    const [ offset, setOffset ] = useState(parseInt(args.get("offset")) || 0);
    const [ sort, setSort ] = useState(args.get("sort") || "timestamp.desc")

    const [ page, setPage ] = useState(Math.floor(offset / limit));
    const [ pages, setPages ] = useState(Math.max(1, page + 1));

    const history = useFetch();
    const checkInfo = useFetch();

    useEffect(() => {
        updateData(limit, offset, sort);
    }, [limit, offset, sort, check]);

    function update(limit, offset, sort) {
        setLimit(limit);
        setOffset(offset);
        setSort(sort);
    }

    function updateData(limit, offset, sort) {
        if (!Str.HasValue(sort)) {
            sort = "timestamp.desc";
        }
		setArgs({...args, "limit": limit, "offset": offset, "sort": sort });
        checkInfo.fetch({
            url: Server.Url(`/checks/${check}`)
        });
        history.refresh({
            url: Server.Url(`/checks/${check}/history?limit=${limit}&offset=${offset}&sort=${sort}`, environ),
            onData: (data) => {
                if (limit > data.paging.total) {
                    setOffset(0);
                }
                setPages(Math.ceil(data.paging.total / limit));
                setPage(Math.floor(offset / limit));
            }
        });
    }

    function onPaginationClick(event) {
        const offset = event.selected * limit % history.get("paging.total");
        update(limit, offset, sort);
    }

    function onSort(key, order) {
        const sort = `${key}.${order}`;
        update(limit, offset, sort);
    }

    function showResult(check, specificHistory, uuid) {
        specificHistory.__resultShowing = true;
        specificHistory.__resultLoading = true;
        specificHistory.__resultError = false;
        history.refresh({
            url: Server.Url(`/checks/${check}/history/${uuid}`, environ),
            onData: (data, current) => {
                if (specificHistory.__resultShowing) {
                    specificHistory.__result = data;
                }
                return current;
            },
            onDone: () => {
                specificHistory.__resultLoading = false;
            },
            onError: () => {
                specificHistory.__resultError = true;
            }
        });
    }

    function hideResult(specificHistory) {
        specificHistory.__resultShowing = false;
        specificHistory.__result = null;
        specificHistory.__resultLoading = false;
        specificHistory.__resultError = false;
        history.update();
    }

    function toggleResult(check, specificHistory, uuid) {
        if (specificHistory.__resultShowing) {
            hideResult(specificHistory);
        }
        else {
            showResult(check, specificHistory, uuid);
        }
    }

    if (history.error) return <FetchErrorBox error={history.error} message="Error loading check history from Foursight API" />
    return <>
        <table style={{maxWidth:"1000pt"}}><tbody>
            { (history.get("list")?.length > 0 || history.loading) ?
            <tr>
                <td style={{paddingRight:"10pt",paddingBottom:"4pt"}}>
                    <table style={{minWidth:"620pt",width:"100%"}}><tbody><tr>
                    <td style={{width:"90%"}}>
                        <PaginationComponent
                            pages={pages}
                            onChange={onPaginationClick}
                            refresh={() => updateData(limit, offset, sort)}
                            page={page}
                            spinner={true}
                            loading={history.loading} />
                    </td>
                    <td style={{width:"10%",whiteSpace:"nowrap",verticalAlign:"bottom",align:"right"}}>
                        <div className="fg" style={{fontSize:"small",fontWeight:"bold"}}>
                            Page Size:&nbsp;
                            <span style={{cursor:history.loading ? "not-allowed" : "",width:"fit-content"}}>
                            <span style={{pointerEvents:history.loading ? "none" : "",width:"fit-content"}}>
                            <select style={{border:"0",marginRight:"2pt"}} defaultValue={limit} onChange={e => {update(parseInt(e.target.value), offset, sort)}}>
                                <option>10</option>
                                <option>25</option>
                                <option>50</option>
                                <option>75</option>
                                <option>100</option>
                                <option>200</option>
                            </select>
                            </span></span>
                            |
                            Showing {offset + 1} thru {Math.min(offset + limit, history.get("paging.total"))} | Total: {history.get("paging.total")}&nbsp;&nbsp;
                        </div>
                    </td>
                    </tr></tbody></table>
                </td>
                <td style={{verticalAlign:"bottom",paddingBottom:"2pt"}}>
                    { checkInfo.get("type") === "action" ? <> <b>Action</b> </>:<> <b>Check</b> </>} <b>Details</b>
                </td>
            </tr>
            : <>
                <tr>
                    <td>
                        { checkInfo.get("type") === "action" ? <> <b>Action</b> </>:<> <b>Check</b> </>} <b>History</b>
                    </td>
                    <td style={{verticalAlign:"bottom",paddingBottom:"2pt"}}>
                        { checkInfo.get("type") === "action" ? <> <b>Action</b> </>:<> <b>Check</b> </>} <b>Details</b>
                    </td>
                </tr>
            </>}
            <tr>
                <td style={{verticalAlign:"top",paddingRight:"10pt"}}>
                    <HistoryList check={check} checkInfo={checkInfo} history={history} limit={limit} offset={offset} sort={sort} onSort={onSort} updateData={updateData} hideResult={hideResult} toggleResult={toggleResult} />
                </td>
                <td style={{verticalAlign:"top",maxWidth:"500pt"}}>
                    { (checkInfo.get("type") === "action") ?
                        <ActionDetailBox check={check} checkInfo={checkInfo} />
                    :
                        <CheckDetailBox check={check} checkInfo={checkInfo} />
                    }
                    { (checkInfo.get("type") !== "action") && <>
                        <div style={{marginTop:"4pt",marginBottom:"1pt"}}><b>Check Run</b></div>
                        <CheckBoxWithFetch
                            checkName={check}
                            env={environ}
                            showRunBox={true}
                            showStandaloneCheckPageLink={false}
                            width={"100%"} />
                    </> }
                </td>
            </tr>
        </tbody></table>
    </>
};

    const HistoryList = ({ check, checkInfo, history, limit, offset, sort, onSort, updateData, hideResult, toggleResult}) => {

        function extractUUID(history) {
            return !history ? "uuid" : history[2].uuid;
        }
        function extractStatus(history) {
            return !history ? "status" : history[0];
        }
        function extractTimestamp(history) {
            return !history ? "timestamp" : history[2].timestamp;
        }
        function extractDuration(history) {
            return !history ? "duration" : history[2].runtime_seconds;
        }
        function extractState(history) {
            return !history ? "state" : history[2].queue_action;
        }
     // function extractSummary(history) {
     //     return !history ? "summary" : history[1];
     // }

        let columns = [
            { label: "__refresh" },
            { label: "" },
            { label: "Timestamp", key: extractTimestamp },
            { label: "UUID", key: extractUUID },
            { label: "Status"},
            { label: "Duration", align: "right" },
            { label: "State" }
        ];

        return <div className="box" style={{paddingTop:"6pt",paddingBottom:"6pt",minWidth:"300pt"}}>

            <div title={check}>
                { history.get("list")?.length > 0 ? <>
                    { checkInfo.get("type") === "action" ? <>
                        <b id={`tooltip-action-name-${check}`}>Action History</b>: <b>{checkInfo.get("name")}</b>&nbsp;
                        <Tooltip id={`tooltip-action-name-${check}`} position="top" text={`Action: ${check}.`} />
                    </>:<>
                        <b id={`tooltip-name-${check}`}>Check History</b>: <b>{checkInfo.get("title")}</b>&nbsp;
                        <Tooltip id={`tooltip-name-${check}`} position="top" text={`Check: ${check}.`} />
                    </>}
                </>:<>
                    { checkInfo.get("type") === "action" ? <>
                        <b>{checkInfo.get("name")}</b>&nbsp;
                    </>:<>
                        <b>{checkInfo.get("title")}</b>&nbsp;
                    </>}
                </>}
            </div>
            <div style={{marginBottom:"6pt"}}/>
                { history.get("list")?.length > 0 ? (<>
                    <table style={{width:"100%"}} className="fg">
                        <TableHead
                            columns={columns}
                            list={history.get("list")}
                            state={{key: extractTimestamp, order: sort.endsWith(".desc") ? -1 : 1}}
                            update={(key, order) => {onSort(key, order);}}
                            refresh={() => updateData(limit, offset, sort)}
                            lines={true}
                            style={{fontWeight:"bold"}}
                            loading={history.loading} />
                    <tbody>
                    {history.map("list", (history, index) =>
                        <React.Fragment key={extractUUID(history)}>
                            { index !== 0 && (<>
                                <tr><td style={{paddingTop:"2px"}}></td></tr>
                                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            </>)}
                            <tr>
                            <td style={{verticalAlign:"top"}}>
                                {extractStatus(history) === "PASS" ? (<>
                                    <span>{Char.Check}</span>
                                </>):(<>
                                    <span style={{color:"darkred"}}>{Char.X}</span>
                                </>)}
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",textAlign:"right"}}>
                                <small>{offset + index + 1}.</small>
                            &nbsp;</td>
                            <td style={{verticalAlign:"top",whiteSpace:"nowrap"}}>
                                <span id={`tooltip-timestamp-${index}`} onClick={() => toggleResult(check, history, extractUUID(history))} style={{cursor:"pointer"}}>
                                    {extractTimestamp(history)}
                                </span>
                                <Tooltip id={`tooltip-timestamp-${index}`} text={Time.Ago(extractTimestamp(history))} position="right" shape="squared" />
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",whiteSpace:"nowrap"}}>
                                {extractUUID(history)}
                            &nbsp;&nbsp;</td>
                            <td id={`tooltip-status-${index}`} style={{verticalAlign:"top",whiteSpace:"break-spaces"}}>
                                {extractStatus(history) === "PASS" ? (<>
                                    <b>OK</b>
                                </>):(<>
                                    {extractStatus(history) === "FAIL" ? (<>
                                        <b style={{color:"darkred"}}>FAILURE</b>
                                    </>):(<>
                                        <b style={{color:"darkred"}}>ERROR</b>
                                    </>)}
                                </>)}
                                {/* <br/> <small> {extractSummary(history)} </small> */}
                                <Tooltip id={`tooltip-status-${index}`} text={extractStatus(history)} position="right" shape="squared" offset={-12} />
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",textAlign:"right"}}>
                                {extractDuration(history)}
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",whiteSpace:"nowrap"}}>
                                {extractState(history)}
                            </td>
                            </tr>
                            { (history.__resultShowing) &&
                                <tr>
                                    <td colSpan="9">
                                        <pre className="box lighten" style={{borderWidth:"1",wordWrap: "break-word",paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"4pt",marginTop:"4pt",marginRight:"5pt",minWidth:"360pt",maxWidth:"600pt"}}>
                                            { history.__resultLoading ? <>
                                                <StandardSpinner condition={history.__resultLoading} color={Styles.GetForegroundColor()} label="Loading result"/>
                                            </>:<>
                                                <div style={{float:"right",marginTop:"-0px"}}>
                                                    <span style={{fontSize:"0",opacity:"0"}} id={check}>{Json.Str(history.__result[0])}</span>
                                                    <img alt="copy" onClick={() => Clipboard.Copy(check)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                                                    <span onClick={() => hideResult(history)} style={{marginLeft:"6pt",marginRight:"2pt",fontSize:"large",fontWeight:"bold",cursor:"pointer"}}>X</span>
                                                </div>
                                                {Yaml.Format(history.__result)}
                                            </>}
                                        </pre>
                                    </td>
                                </tr>
                            }
                        </React.Fragment>
                    )}
                    </tbody>
                    </table>
                </>):(<>
                    <span style={{color:"black"}}>{ history.loading ? <i>Loading ...</i> : <><div style={{background:"gray",marginBottom:"2pt",height:"1px"}} />No history</> }</span>
                </>)}
        </div>
    }

const ActionDetailBox = ({check, checkInfo}) => {
    return <>
        <div className="box">
            <table><tbody style={{fontSize:"small",verticalAlign:"top"}}>
                <tr style={{fontSize:"12pt"}}>
                    <td style={{paddingRight:"8pt"}}><b>Name</b>:</td>
                    <td>
                        {checkInfo.get("name")}
                        <a id={`tooltip-action-source-${check.name}`} style={{marginLeft:"3pt",marginRight:"4pt"}} rel="noreferrer" target="_blank" href={checkInfo.get("github_url")}><img alt="github" src={Image.GitHubLoginLogo()} height="13"/></a>
                        <Tooltip id={`tooltip-action-source-${check.name}`} text="Click to view source code for this action (in new tab)." position="top" />
                    </td>
                </tr>
                <tr><td style={{paddingTop:"2px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td><b>Checks</b>:</td>
                    <td>
                        {checkInfo.map("checks", (check, index) => <>
                            <Link to={Client.Path(`/checks/${check.name}/history`)}>{check.name}</Link>
                            <a id={`tooltip-source-${check.name}`} style={{marginLeft:"3pt",marginRight:"4pt"}} rel="noreferrer" target="_blank" href={check.registered_github_url}><img alt="github" src={Image.GitHubLoginLogo()} height="13"/></a>
                            <Tooltip id={`tooltip-source-${check.name}`} text="Click to view source code for this check (in new tab)." position="bottom" />
                            <br />
                        </>)}
                    </td>
                </tr>
                <tr><td style={{paddingTop:"2px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td><b>Code</b>:</td>
                    <td>
                        {basename(checkInfo.get("file"))} <br />
                        <small>{dirname(checkInfo.get("file"))}</small>
                    </td>
                </tr>
                <tr><td style={{paddingTop:"2px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td><b>Module</b>:</td>
                    <td>
                        {checkInfo.get("module")}
                    </td>
                </tr>
                <tr><td style={{paddingTop:"2px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td style={{paddingRight:"8pt"}}><b>Package</b>:</td>
                    <td>
                        {checkInfo.get("package")}
                    </td>
                </tr>
                <tr><td style={{paddingTop:"2px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td>
                        <b>GitHub</b>:
                    </td>
                    <td>
                        <a href={checkInfo.get("github_url")} rel="noreferrer" target="_blank">
                            {checkInfo.get("github_url")}
                        </a>
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
}

const CheckDetailBox = ({check, checkInfo}) => {

    function getDependenciesFromCheck(checkInfo) {
        const schedule = checkInfo.get("schedule");
        if (schedule) {
            const scheduleValues = Object.values(schedule);
            if (scheduleValues && scheduleValues.length > 0) {
                const scheduleFirstElement = scheduleValues[0];
                if (scheduleFirstElement) {
                    const scheduleFirstElementEnv = scheduleFirstElement[Env.PreferredName(Env.Current())];
                    if (scheduleFirstElementEnv && scheduleFirstElementEnv?.dependencies?.length > 0) {
                        return scheduleFirstElementEnv.dependencies;
                    }
                }
            }
        }
        return [];
    }

    function getCronFromCheck(check) {
        return Type.IsNonEmptyObject(check?.schedule) ? check.schedule[Object.keys(check.schedule)[0]]?.cron : "";
    }

    function getCronDescriptionFromCheck(check) {
        return Type.IsNonEmptyObject(check?.schedule) ? check.schedule[Object.keys(check.schedule)[0]]?.cron_description : "";
    }

    return <>
        <div className="box" style={{paddingTop:"4pt",paddingBottom:"6pt",marginBottom:"6pt"}}>
            <table><tbody style={{fontSize:"small",verticalAlign:"top"}}>
                <tr style={{fontSize:"12pt"}}>
                    <td style={{paddingRight:"8pt"}}><b>Name</b>:</td>
                    <td>
                        {checkInfo.get("name")}
                        <a id={`tooltip-source-${check.name}`} style={{marginLeft:"3pt",marginRight:"4pt"}} rel="noreferrer" target="_blank" href={checkInfo.get("registered_github_url")}><img alt="github" src={Image.GitHubLoginLogo()} height="13"/></a>
                        <Tooltip id={`tooltip-source-${check.name}`} text="Click to view source code for this check (in new tab)." position="top" />
                    </td>
                </tr>
                <tr><td style={{paddingTop:"3px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td style={{paddingRight:"8pt"}}><b>Title</b>:</td>
                    <td>
                        {checkInfo.get("title")} <br />
                    </td>
                </tr>
                <tr><td style={{paddingTop:"3px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td style={{paddingRight:"8pt"}}><b>Group</b>:</td>
                    <td>
                        {checkInfo.get("group")}
                    </td>
                </tr>
                <tr><td style={{paddingTop:"4px"}}></td></tr>
                <tr><td style={{height:"1px",background:"black"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td style={{verticalAlign:"top",paddingRight:"8pt"}}><b>Schedule:</b></td>
                    <td>
                        {getCronDescriptionFromCheck(checkInfo.data)}
                        <br />
                        <span style={{fontFamily:"monospace"}}>
                            {getCronFromCheck(checkInfo.data)}
                        </span>
                    </td>
                </tr>
                { getDependenciesFromCheck(checkInfo).length > 0 && <>
                    <tr><td style={{paddingTop:"3px"}}></td></tr>
                    <tr><td style={{height:"1px",background:"black"}} colSpan="9"></td></tr>
                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                    <tr>
                        <td style={{paddingRight:"8pt"}}><b>Dependencies</b>:</td>
                        <td>
                            {getDependenciesFromCheck(checkInfo).map(dependency => <>
                                <Link to={Client.Path(`/checks/${dependency}/history`)}>{dependency}</Link>
                            </>)} <br />
                        </td>
                    </tr>
                </>}
                { (checkInfo.data?.referrers) && <>
                    <tr><td style={{paddingTop:"3px"}}></td></tr>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                    <tr>
                        <td><b>Referrers</b>:</td>
                        <td>
                            {checkInfo.map("referrers", referrer => <>
                                <Link to={Client.Path(`/checks/${referrer}/history`)}>{referrer}</Link>
                            </>)}
                        </td>
                    </tr>
                </>}
                <tr><td style={{paddingTop:"3px"}}></td></tr>
                <tr><td style={{height:"1px",background:"black"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td><b>Code</b>:</td>
                    <td>
                        {basename(checkInfo.get("registered_file"))} <br />
                        <small>{dirname(checkInfo.get("registered_file"))}</small>
                    </td>
                </tr>
                <tr><td style={{paddingTop:"3px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td><b>Module</b>:</td>
                    <td>
                        {checkInfo.get("registered_module")}
                    </td>
                </tr>
                <tr><td style={{paddingTop:"3px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td><b>Package</b>:</td>
                    <td>
                        {checkInfo.get("registered_package")}
                    </td>
                </tr>
                <tr><td style={{paddingTop:"3px"}}></td></tr>
                <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                <tr>
                    <td>
                        <b>GitHub</b>:
                    </td>
                    <td>
                        <a href={checkInfo.get("registered_github_url")}  rel="noreferrer" target="_blank">
                            {checkInfo.get("registered_github_url")}
                        </a>
                    </td>
                </tr>
            </tbody></table>
        </div>
        { checkInfo.get("registered_action") && <>
            <b>Associated Action</b>
            <div className="box" style={{paddingTop:"4pt",paddingBottom:"6pt",marginBottom:"6pt"}}>
                <table><tbody style={{fontSize:"small",verticalAlign:"top"}}>
                    <tr style={{fontSize:"12pt"}}>
                        <td style={{paddingRight:"8pt"}}><b>Name</b>:</td>
                        <td>
                            <Link to={Client.Path(`/checks/${checkInfo.get("registered_action.name")}/history`)}>{checkInfo.get("registered_action.name")}</Link>
                            <a id={`tooltip-action-source-${check}`}  style={{marginLeft:"3pt",marginRight:"4pt"}} rel="noreferrer" target="_blank" href={checkInfo.get("registered_action.github_url")}><img alt="github" src={Image.GitHubLoginLogo()} height="13"/></a>
                            <Tooltip id={`tooltip-action-source-${check}`} text="Click to view source code for this action (in new tab)." position="top" />
                        </td>
                    </tr>
                    <tr><td style={{paddingTop:"3px"}}></td></tr>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                    <tr>
                        <td style={{paddingRight:"8pt"}}><b>Checks</b>:</td>
                        <td>
                            {checkInfo.get("registered_action.checks").sort().map(check => <React.Fragment key={check}>
                                { (check === checkInfo.get("name")) ?
                                    <>{check}</>
                                :
                                    <Link to={Client.Path(`/checks/${check}/history`)}>{check}</Link>
                                }
                                <br />
                            </React.Fragment>)}
                        </td>
                    </tr>
                    <tr><td style={{paddingTop:"3px"}}></td></tr>
                    <tr><td style={{height:"1px",background:"black"}} colSpan="9"></td></tr>
                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                    <tr>
                        <td style={{paddingRight:"8pt"}}><b>Code</b>:</td>
                        <td>
                            {basename(checkInfo.get("registered_action.file"))} <br />
                            <small>{dirname(checkInfo.get("registered_action.file"))}</small>
                        </td>
                    </tr>
                    <tr><td style={{paddingTop:"3px"}}></td></tr>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                    <tr>
                        <td style={{paddingRight:"8pt"}}><b>Module</b>:</td>
                        <td>
                            {checkInfo.get("registered_action.module")}
                        </td>
                    </tr>
                    <tr><td style={{paddingTop:"3px"}}></td></tr>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                    <tr>
                        <td style={{paddingRight:"8pt"}}><b>Package</b>:</td>
                        <td>
                            {checkInfo.get("registered_action.package")}
                        </td>
                    </tr>
                    <tr><td style={{paddingTop:"3px"}}></td></tr>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                    <tr><td style={{paddingBottom:"2px"}}></td></tr>
                    <tr>
                        <td style={{paddingRight:"8pt"}}><b>GitHub</b>:</td>
                        <td>
                            <a href={checkInfo.get("registered_action.github_url")} rel="noreferrer" target="_blank">
                                {checkInfo.get("registered_action.github_url")}
                            </a>
                        </td>
                    </tr>
                </tbody></table>
            </div>
        </>}
    </>
}

export default CheckHistoryPage;
