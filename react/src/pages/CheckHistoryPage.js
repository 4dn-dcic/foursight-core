import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useFetch } from '../utils/Fetch';
import { StandardSpinner } from '../Spinners';
import PaginationControl from '../PaginationControl';
import Clipboard from '../utils/Clipboard';
import Image from '../utils/Image';
import Json from '../utils/Json';
import Server from '../utils/Server';
import Str from '../utils/Str';
import TableHead from '../TableHead';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';

const CheckHistoryPage = (props) => {

    const { environ, check } = useParams();
    const [ args, setArgs ] = useSearchParams();

    const [ limit, setLimit ] = useState(parseInt(args.get("limit")) || 25);
    const [ offset, setOffset ] = useState(parseInt(args.get("offset")) || 0);
    const [ sort, setSort ] = useState(args.get("sort") || "timestamp.desc")

    const [ page, setPage ] = useState(Math.floor(offset / limit));
    const [ pages, setPages ] = useState(Math.max(1, page + 1));

    const history = useFetch();

    useEffect(() => {
        updateData(limit, offset, sort);
    }, [limit, offset, sort]);

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
        history.refresh({
            url: Server.Url(`/checks/${check}/history?limit=${limit}&offset=${offset}&sort=${sort}`, environ),
            onData: (data) => {
                if (limit > data.paging.total) {
                    setOffset(0);
                }
                setPages(Math.ceil(data.paging.total / limit));
                setPage(Math.floor(offset / limit));
                return data;
            }
        });
/*
        const url = Server.Url(`/checks/${check}/history?limit=${limit}&offset=${offset}&sort=${sort}`, environ);
        Fetch.get(url, response => {
            response.loading = false;
            setHistory(response);
            setLimit(limit);
            setOffset(offset);
            setSort(sort);
            setPages(Math.ceil(response.paging.total / limit));
            setPage(Math.floor(offset / limit));
        }, () => { history.loading = false; }, () => { history.error = true; } );
*/
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
            url: Server.Url(`/checks/${check}/${uuid}`, environ),
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
/*
        const url = Server.Url(`/checks/${check}/${uuid}`, environ);
        Fetch.get(url, response => {
            if (history.__resultShowing) {
                history.__result = response;
                setHistory(e => ({...e}));
            }
        }, () => { history.__resultLoading = false; setHistory(e => ({...e})); }, () => { history.__resultError = true; } );
*/
    }

    function hideResult(specificHistory) {
        specificHistory.__resultShowing = false;
        specificHistory.__result = null;
        specificHistory.__resultLoading = false;
        specificHistory.__resultError = false;
        history.update();
        //setHistory(e => ({...e}));
    }

    function toggleResult(check, specificHistory, uuid) {
        if (specificHistory.__resultShowing) {
            hideResult(specificHistory);
        }
        else {
            showResult(check, specificHistory, uuid);
        }
    }

    const HistoryList = ({history}) => {

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
            { label: "" },
            { label: "" },
            { label: "Timestamp", key: extractTimestamp },
            { label: "UUID", key: extractUUID },
            { label: "Status"},
            { label: "Duration", align: "right" },
            { label: "State" }
        ];

        return <div className="boxstyle info" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>

            <div title={check}>
                <b>Check: {check}</b>&nbsp;
                <span style={{float:"right",cursor:"pointer"}} onClick={() => {}}><b>&#x2717;</b></span>
            </div>
            <div style={{marginBottom:"6pt"}}/>
                { history.get("list")?.length > 0 ? (<>
                    <table style={{width:"100%"}}>
                        <TableHead
                            columns={columns}
                            list={history.get("list")}
                            state={{key: extractTimestamp, order: sort.endsWith(".desc") ? -1 : 1}}
                            update={(key, order) => {onSort(key, order);}}
                            lines={true}
                            style={{color:"darkblue",fontWeight:"bold"}}
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
                                    <span style={{color:"darkblue"}}>&#x2713;</span>
                                </>):(<>
                                    <span style={{color:"darkred"}}>&#x2717;</span>
                                </>)}
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",textAlign:"right"}}>
                                <small>{offset + index + 1}.</small>
                            &nbsp;</td>
                            <td style={{verticalAlign:"top",whiteSpace:"nowrap"}}>
                                <span onClick={() => toggleResult(check, history, extractUUID(history))} style={{cursor:"pointer"}}>
                                    {extractTimestamp(history)}
                                </span>
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",whiteSpace:"nowrap"}}>
                                {extractUUID(history)}
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",whiteSpace:"break-spaces"}}>
                                {extractStatus(history) === "PASS" ? (<>
                                    <b style={{color:"darkblue"}}>OK</b>
                                </>):(<>
                                    <b style={{color:"darkred"}}>ERROR</b>
                                </>)}
                                {/* <br/> <small> {extractSummary(history)} </small> */}
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
                                    <td></td>
                                    <td></td>
                                    <td colSpan="9">
                                        <pre style={{background:"#D6EAF8",filter:"brightness(1.1)",borderColor:"darkblue",borderWidth:"1",wordWrap: "break-word",paddingTop:"6pt",paddingBottom:"6pt",marginBottom:"4pt",marginTop:"4pt",marginRight:"5pt",minWidth:"360pt",maxWidth:"600pt"}}>
                                            { history.__resultLoading ? <>
                                                <StandardSpinner condition={history.__resultLoading} color={"darkblue"} label="Loading result"/>
                                            </>:<>
                                                <div style={{float:"right",marginTop:"-0px"}}>
                                                    <span style={{fontSize:"0",opacity:"0"}} id={check}>{Json.Str(history.__result[0])}</span>
                                                    <img alt="copy" onClick={() => Clipboard.Copy(check)} style={{cursor:"copy",fontFamily:"monospace",position:"relative",bottom:"2pt"}} src={Image.Clipboard()} height="19" />
                                                    <span onClick={() => hideResult(history)} style={{marginLeft:"6pt",marginRight:"2pt",fontSize:"large",fontWeight:"bold",cursor:"pointer"}}>X</span>
                                                </div>
                                                {Yaml.Format(history.__result[0])}
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
                    <span style={{color:"black"}}>{ history.loading ? <i>Loading ...</i> : <>No history</> }</span>
                </>)}
        </div>
    }

    function getCronFromCheck(check) {
        return Type.IsNonEmptyObject(check?.schedule) ? check.schedule[Object.keys(check.schedule)[0]]?.cron : "";
    }

    function getCronDescriptionFromCheck(check) {
        return Type.IsNonEmptyObject(check?.schedule) ? check.schedule[Object.keys(check.schedule)[0]]?.cron_description : "";
    }


    if (history.error) return <>Cannot load data from Foursight: {history.error}</>;
    return <>
        <table style={{maxWidth:"1000pt"}}><tbody>
            <tr>
                <td style={{paddingRight:"10pt",paddingBottom:"4pt"}}>
                    <table style={{minWidth:"620pt",width:"100%"}}><tbody><tr>
                    <td style={{width:"90%"}}>
                        <PaginationControl
                            pages={pages}
                            onChange={onPaginationClick}
                            page={page}
                            spinner={true}
                            loading={history.loading} />
                    </td>
                    <td style={{width:"10%",whiteSpace:"nowrap",verticalAlign:"bottom",align:"right"}}>
                        <div style={{fontSize:"small",fontWeight:"bold",color:"darkblue"}}>
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
                            Showing {offset + 1} thru {offset + limit} | Total: {history.get("paging.total")}&nbsp;&nbsp;
                        </div>
                    </td>
                    </tr></tbody></table>
                </td>
                <td><b>Check History</b></td>
            </tr>
            <tr>
                <td style={{verticalAlign:"top",paddingRight:"10pt"}}>
                    <HistoryList history={history} />
                </td>
                <td style={{verticalAlign:"top"}}>
                    <div className="boxstyle info" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                        <table><tbody>
                            <tr>
                                <td style={{paddingRight:"8pt"}}><b>Check</b>:</td>
                                <td>{check}</td>
                            </tr>
                            <tr><td style={{paddingTop:"2px"}}></td></tr>
                            <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                            <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            <tr>
                                <td style={{paddingRight:"8pt"}}><b>Group</b>:</td>
                                <td>{history.get("check.group")}</td>
                            </tr>
                            <tr><td style={{paddingTop:"2px"}}></td></tr>
                            <tr><td style={{height:"1px",background:"gray"}} colSpan="9"></td></tr>
                            <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            <tr>
                                <td style={{verticalAlign:"top",paddingRight:"8pt"}}><b>Schedule:</b></td>
                                <td>
                                    {getCronDescriptionFromCheck(history.get("check"))}
                                    <br />
                                    <span style={{fontFamily:"monospace"}}>
                                        {getCronFromCheck(history.get("check"))}
                                    </span>
                                </td>
                            </tr>
                        </tbody></table>
                    </div>
                    <div className="boxstyle info" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                        <b style={{color:"darkred"}}>TODO</b>
                        <p />
                        - Have dropdown to pick other checks (maybe by group). <br />
                        - Allow check to be run here.<br />
                    </div>
                </td>
            </tr>
        </tbody></table>
    </>
};

export default CheckHistoryPage;
