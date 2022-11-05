import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { RingSpinner } from './Spinners';
import { useFetch } from './utils/Fetch';
import Char from './utils/Char';
import Client from './utils/Client';
import PaginationControl from './PaginationControl';
import { PuffSpinner, BarSpinner } from './Spinners';
import Server from './utils/Server';
import Str from './utils/Str';
import TableHead from './TableHead';
import Time from './utils/Time';

const PagedTableComponent = ({columns, data, update, initialSort, children}) => {

    const [ args, setArgs ] = useSearchParams();
    const [ limit, setLimit ] = useState(parseInt(args.get("limit")) || 5);
    const [ offset, setOffset ] = useState(parseInt(args.get("offset")) || 0);
    const [ sort, setSort ] = useState(args.get("sort") || initialSort)
    const [ pageNumber, setPageNumber ] = useState();
    const [ pageCount, setPageCount ] = useState();

    useEffect(() => {
        updateData();
    }, [limit, offset, sort]);


    function updateData() {
		setArgs({...args, "limit": limit, "offset": offset, "sort": sort });
        function onDone(response) {
            const total = parseInt(response.get("paging.total"));
            if (limit > total) {
                setOffset(0);
            }
            setPageCount(Math.ceil(total / limit));
            setPageNumber(Math.floor(offset / limit));
        }
        update(limit, offset, sort, onDone);
    }

    function onPageSize(event) {
        setLimit(parseInt(event.target.value));
    }

    function onPageNumber(event) {
        setOffset(event.selected * limit % parseInt(data?.get("paging.total")));
    }

    function onSort(key, order) {
        setSort(`${key}.${order}`);
    }

    return <>
        <div className="container">
            <table style={{width:"100%"}} border="0"><tbody><tr><td style={{width:"90%"}}>
                <PaginationControl
                    pages={pageCount}
                    page={pageNumber}
                    onChange={onPageNumber}
                    loading={data?.loading}
                    spinner={true} />
                </td><td style={{align:"right",fontSize:"small",fontWeight:"bold",whiteSpace:"nowrap"}}>
                      Page Size:&nbsp;
                      <span style={{cursor:data?.loading ? "not-allowed" : "",width:"fit-content"}}>
                      <span style={{pointerEvents:data?.loading ? "none" : "",width:"fit-content"}}>
                      <select style={{border:"0",marginRight:"2pt"}} defaultValue={limit} onChange={onPageSize}>
                          <option>5</option>
                          <option>10</option>
                          <option>25</option>
                          <option>50</option>
                          <option>75</option>
                          <option>100</option>
                          <option>200</option>
                      </select>
                      </span></span>&nbsp;
                      <span>Showing {offset + 1} ... {offset + limit}&nbsp;|&nbsp;</span>
                      <span>More: {data?.get("paging.more")}&nbsp;|&nbsp;</span>
                      <span>Total: {data?.get("paging.total")}&nbsp;</span>
                </td></tr></tbody></table>
                <div className="info boxstyle" style={{marginTop:"4pt",paddingTop:"8pt"}}>
                <table style={{width:"100%"}}>
                    <TableHead
                        columns={columns}
                        sort={sort}
                        list={data?.get("list")}
                        update={onSort}
                        bottomline={true}
                        style={{color:"darkblue",fontWeight:"bold"}}
                        loading={data?.loading} />
                    <tbody>
                        {children}
                    </tbody>
                </table>
            </div>
        </div>
    </>
};

export default PagedTableComponent;
