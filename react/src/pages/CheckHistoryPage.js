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

    const [ header, setHeader ] = useContext(Global);
    const { environ } = useParams();
    const { check } = useParams();
    const [ args, setArgs ] = useSearchParams();
    const [ limit, setLimit ] = useState(parseInt(args.get("limit")) || 10);
    const [ offset, setOffset ] = useState(args.get("offset") || 0);
    const [ sort, setSort ] = useState(args.get("sort") || "timestamp.desc")
	console.log("TOPSET.......................")
	console.log(args)
	console.log(args.get("offset"))
	console.log(offset)
  	const [ pages, setPages ] = useState(0);
  	const [ page, setPage ] = useState((offset + 1) / limit);
  	const [ history, setHistory ] = useState({});
  	const [ loading, setLoading ] = useState(true);
    const [ error, setError ] = useState(0);

    useEffect(() => {
        const url = SERVER.Url(`/checks/${check}/history?offset=${offset}&limit=${limit}&sort=${sort}`, environ);
		console.log("TOP-FETCH: " + url)
        FETCH.get(url, response => {
            setHistory(response);
            setPages(Math.ceil(response.paging.total / limit));
			setOffset(offset);
			setHeader(e => ({...e, contentLoading: false}));
        }, setLoading, setError);
    }, []);

  	function onPaginationClick(event) {
		if (loading) { return; }
		const newOffset = event.selected * limit % history.paging.total;
		setArgs({"offset": newOffset});
		setOffset(newOffset);
		console.log(`ON-PAGE: selected = ${event.selected} | limit = ${limit} | pages = ${pages} | old-offset = ${offset} | new-offset = ${newOffset} `)
    	console.log(`User requested page number ${event.selected+1}, which is offset ${event.selected * limit % history.paging.total}`);
        const url = SERVER.Url(`/checks/${check}/history?offset=${newOffset}&limit=${limit}&sort=${sort}`, environ);
		console.log("INNER-FETCH: " + url)
		setLoading(true)
		setHeader(e => ({...e, contentLoading: true}));
        FETCH.get(url, response => {
            setHistory(response);
        	setPages(Math.ceil(response.paging.total / limit));
			setOffset(newOffset);
			setHeader(e => ({...e, contentLoading: false}));
        }, setLoading, setError);
  	}
  	function onSort(key, order) {
	console.log("SORT..................................")
	console.log(key)
	console.log(order)
	return
        const url = SERVER.Url(`/checks/${check}/history?offset=${offset}&limit=${limit}&sort=${key}.${order}`, environ);
		setHeader(e => ({...e, contentLoading: true}));
        FETCH.get(url, response => {
            setHistory(response);
        	setPages(Math.ceil(response.paging.total / limit));
			setOffset(offset);
			setHeader(e => ({...e, contentLoading: false}));
        }, setLoading, setError);
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

        let columns = [
            { label: "" },
            { label: "" },
            { label: "Timestamp", key: extractTimestamp },
            { label: "Status", key: extractStatus},
            { label: "Duration", key: extractDuration, align: "right" },
            { label: "State", key: extractState }
        ];

        return <div className="boxstyle check-pass" style={{paddingTop:"6pt",paddingBottom:"6pt"}}>

            <div title={history.check}>
                <b>{history?.check}</b>&nbsp;
                { history.list && <span>&nbsp;&nbsp;<span className={"tool-tip"} data-text={"Click to refresh history."} style={{cursor:"pointer",color:"darkred",fontWeight:"bold"}} onClick={() => {refreshHistory(history?.check)}}>&#8635;&nbsp;&nbsp;</span></span> }
                <span style={{float:"right",cursor:"pointer"}} onClick={() => {}}><b>&#x2717;</b></span>
            </div>
            <div style={{marginBottom:"6pt"}}/>
                { history?.list?.length > 0 ? (<>
                    <table style={{width:"100%"}}>
                        <TableHead columns={columns} list={history.list} state={{key: extractTimestamp, order: -1}} update={(key, order) => {console.log('111111');console.log(order);onSort(key, order);}} style={{color:"darkgreen",fontWeight:"bold"}} />
                    <tbody>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                    <tr><td style={{paddingTop:"4px"}}></td></tr>
                    {history?.list.map((history, index) =>
                        <React.Fragment key={extractUUID(history)}>
                            { index !== 0 && (<>
                                <tr><td style={{paddingTop:"2px"}}></td></tr>
                                <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                                <tr><td style={{paddingBottom:"2px"}}></td></tr>
                            </>)}
                            <tr>
                            <td style={{textAlign:"right"}}>
                                {index}.
                            &nbsp;&nbsp;</td>
                            <td>
                                {extractStatus(history) === "PASS" ? (<>
                                    <span style={{color:"darkgreen"}}>&#x2713;</span>
                                </>):(<>
                                    <span style={{color:"darkred"}}>&#x2717;</span>
                                </>)}
                            &nbsp;&nbsp;</td>
                            <td style={{whiteSpace:"nowrap"}}>
                                {extractTimestamp(history)}
                            &nbsp;&nbsp;</td>
                            <td style={{whiteSpace:"nowrap"}}>
                                {extractStatus(history) === "PASS" ? (<>
                                    <b style={{color:"darkgreen"}}>OK</b>
                                </>):(<>
                                    <b style={{color:"darkred"}}>ERROR</b>
                                </>)}
                            &nbsp;&nbsp;</td>
                            <td style={{textAlign:"right"}}>
                                {extractDuration(history)}
                            &nbsp;&nbsp;</td>
                            <td style={{textAlign:"right",whiteSpace:"nowrap"}}>
                                {extractState(history)}
                            &nbsp;&nbsp;</td>
                            </tr>
                        </React.Fragment>
                    )}
                    </tbody>
                    </table>
                </>):(<>
                    <span style={{color:"black"}}>No history.</span>
                </>)}
        </div>
    }

    if (error) return <>Cannot load data from Foursight: {error}</>;
    if (loading) {
        return <>
            <div style={{marginTop:"30px"}}>
            </div>
        </>
    }
    return <>
        <div>
            <table><tbody>
                <tr>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
					<PaginationControl pages={pages} onChange={onPaginationClick} page={page} />
                        <HistoryList history={history} />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
};

export default CheckHistoryPage;
