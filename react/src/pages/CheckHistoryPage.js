import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BarSpinner } from "../Spinners";
import { RingSpinner } from "../Spinners";
import { StandardSpinner } from "../Spinners";
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

    const { environ } = useParams();
    const { check } = useParams();
    const [ args ] = useSearchParams();
    const limit = parseInt(args.get("limit")) || 50;
    const offset = args.get("offset") || 0;
        console.log('xxxxxx')
        console.log(limit)
        console.log(offset)

    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    let [ history, setHistory ] = useState({})

    useEffect(() => {
        const url = SERVER.Url(`/checks/${check}/history?offset=${offset}&limit=${limit}`, environ);
        FETCH.get(url, response => {
            setHistory(response);
        }, setLoading, setError);
    }, []);

    const HistoryBox = ({history}) => {

        function refreshHistory(check) {
        }

        function moreExists() {
        }

        function extractUUID(history) {
            return history[2].uuid;
        }
        function extractStatus(history) {
            return history[0];
        }
        function extractTimestamp(history) {
            return history[2].timestamp;
        }
        function extractDuration(history) {
            return history[2].runtime_seconds;
        }
        function extractState(history) {
            return history[2].queue_action;
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
                <b>{history.check}</b>&nbsp; {history.paging.total}
                { history.list && <span>&nbsp;&nbsp;<span className={"tool-tip"} data-text={"Click to refresh history."} style={{cursor:"pointer",color:"darkred",fontWeight:"bold"}} onClick={() => {refreshHistory(check)}}>&#8635;&nbsp;&nbsp;</span></span> }
                <span style={{float:"right",cursor:"pointer"}} onClick={() => {}}><b>&#x2717;</b></span>
            </div>
            <div style={{marginBottom:"6pt"}}/>
                { history.list?.length > 0 ? (<>
                    <table style={{width:"100%"}}>
                        <TableHead columns={columns} list={history.list} state={{key: extractTimestamp, order: -1}} update={() => setHistory(e => ({...e}))} style={{color:"darkgreen",fontWeight:"bold"}} />
                    <tbody>
                    <tr><td style={{height:"1px",background:"gray"}} colSpan="6"></td></tr>
                    <tr><td style={{paddingTop:"4px"}}></td></tr>
                    {history.list.map((history, index) =>
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
                <RingSpinner loading={loading} color={'blue'} size={90} />
            </div>
        </>
    }
    return <>
        <div>
            <table><tbody>
                <tr>
                    <td style={{paddingLeft:"10pt",verticalAlign:"top"}}>
                        <HistoryBox history={history} />
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
};

export default CheckHistoryPage;
