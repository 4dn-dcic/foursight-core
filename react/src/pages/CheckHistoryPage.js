import React from 'react';
import { useContext, useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BarSpinner } from "../Spinners";
import { RingSpinner } from "../Spinners";
import { StandardSpinner } from "../Spinners";
import Global from '../Global';
import ReactPaginate from 'react-paginate';
import PaginationControl from '../PaginationControl';
import CLIPBOARD from '../utils/CLIPBOARD';
import ENV from '../utils/ENV';
import FETCH from '../utils/FETCH';
import SERVER from '../utils/SERVER';
import STR from '../utils/STR';
import TableHead from '../TableHead';
import TIME from '../utils/TIME';
import TYPE from '../utils/TYPE';
import UUID from '../utils/UUID';
import YAML from '../utils/YAML';

const CheckHistoryPage = (props) => {

    const { environ, check } = useParams();
    const [ args, setArgs ] = useSearchParams();

    const [ limit, setLimit ] = useState(parseInt(args.get("limit")) || 25);
    const [ offset, setOffset ] = useState(parseInt(args.get("offset")) || 0);
    const [ sort, setSort ] = useState(args.get("sort") || "timestamp.desc")

    const [ header, setHeader ] = useContext(Global);
    const [ page, setPage ] = useState(Math.floor(offset / limit));
    const [ pages, setPages ] = useState(Math.max(1, page + 1));
    const [ history, setHistory ] = useState({loading: true});

    useEffect(() => {
        update(limit, offset, sort);
    }, []);

    function update(limit, offset, sort) {
        setHistory(e => ({...e, loading: true}));
        if (!STR.HasValue(sort)) {
            sort = "timestamp.desc";
        }
		setArgs({...args,  "limit": limit, "offset": offset, "sort": sort });
        const url = SERVER.Url(`/checks/${check}/history?limit=${limit}&offset=${offset}&sort=${sort}`, environ);
        FETCH.get(url, response => {
            response.loading = false;
            setHistory(response);
            setLimit(limit);
            setOffset(offset);
            setSort(sort);
            setPages(Math.ceil(response.paging.total / limit));
            setPage(Math.floor(offset / limit));
        }, () => { history.loading = false; }, () => { history.error = true; } );
    }

      function onPaginationClick(event) {
        const offset = event.selected * limit % history.paging.total;
        update(limit, offset, sort);
      }
      function onSort(key, order) {
        const sort = `${key}.${order}`;
        update(limit, offset, sort);
    }

    const HistoryList = ({history}) => {

        function refreshHistory(check) {
        }

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
        function extractSummary(history) {
            return !history ? "summary" : history[1];
        }

        let columns = [
            { label: "" },
            { label: "" },
            { label: "Timestamp", key: extractTimestamp },
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
                { history?.list?.length > 0 ? (<>
                    <table style={{width:"100%"}}>
                        <TableHead
                            columns={columns}
                            list={history.list}
                            state={{key: extractTimestamp, order: sort.endsWith(".desc") ? -1 : 1}}
                            update={(key, order) => {onSort(key, order);}}
                            lines={true}
                            style={{color:"darkblue",fontWeight:"bold"}}
                            loading={history.loading} />
                    <tbody>
                    {history?.list.map((history, index) =>
                        <React.Fragment key={extractUUID(history)}>
                            { index !== 0 && (<>
                                <tr><td style={{paddingTop:"2px"}}></td></tr>
                                <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            </>)}
                            <tr>
                            <td>
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
                                {extractTimestamp(history)}
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",whiteSpace:"break-spaces"}}>
                                {extractStatus(history) === "PASS" ? (<>
                                    <b style={{color:"darkblue"}}>OK</b>
                                </>):(<>
                                    <b style={{color:"darkred"}}>ERROR</b>
                                </>)}
                                <br/>
                                <small>
                                    {extractSummary(history)}
                                </small>
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",textAlign:"right"}}>
                                {extractDuration(history)}
                            &nbsp;&nbsp;</td>
                            <td style={{verticalAlign:"top",whiteSpace:"nowrap"}}>
                                {extractState(history)}
                            </td>
                            </tr>
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
        return TYPE.IsNonEmptyObject(check?.schedule) ? check.schedule[Object.keys(check.schedule)[0]]?.cron : "";
    }

    function getCronDescriptionFromCheck(check) {
        return TYPE.IsNonEmptyObject(check?.schedule) ? check.schedule[Object.keys(check.schedule)[0]]?.cron_description : "";
    }


    if (history.error) return <>Cannot load data from Foursight: {history.error}</>;
    return <>
        <table style={{maxWidth:"1000pt"}}><tbody>
            <tr>
                <td style={{paddingRight:"10pt",paddingBottom:"4pt"}}>
                    <table style={{minWidth:"550pt",width:"100%"}}><tbody><tr>
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
                            Showing {offset + 1} thru {offset + limit} | Total: {history?.paging?.total}&nbsp;&nbsp;
                        </div>
                    </td>
                    </tr></tbody></table>
                </td>
                <td><b>Check History</b></td>
            </tr>
            <tr>
                <td style={{paddingRight:"10pt"}}>
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
                            <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                            <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            <tr>
                                <td style={{paddingRight:"8pt"}}><b>Group</b>:</td>
                                <td>{history?.check?.group}</td>
                            </tr>
                            <tr><td style={{paddingTop:"2px"}}></td></tr>
                            <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                            <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            <tr>
                                <td style={{paddingRight:"8pt"}}><b>Schedule:</b></td>
                                <td>
                                    {getCronDescriptionFromCheck(history.check)}
                                    <br />
                                    <span style={{fontFamily:"monospace"}}>
                                        {getCronFromCheck(history.check)}
                                    </span>
                                </td>
                            </tr>
                        </tbody></table>
                    </div>
                    <div className="boxstyle info" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>
                        <b style={{color:"darkred"}}>TODO</b>
                        <p />
                        - Show full result output on click of each item.
                    </div>
                </td>
            </tr>
        </tbody></table>
    </>
};

export default CheckHistoryPage;
