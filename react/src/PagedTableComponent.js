import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PaginationComponent from './PaginationComponent';
import Str from './utils/Str';
import TableHead from './TableHead';
import Styles from './Styles';
import Type from './utils/Type';

const PagedTableComponent = ({columns, data, update, initialSort, children}) => {

    const [ args, setArgs ] = useSearchParams();
    const [ limit, setLimit ] = useState(defaultLimit());
    const [ offset, setOffset ] = useState(defaultOffset());
    const [ sort, setSort ] = useState(initialSort);
    const [ total, setTotal ] = useState(0);
    const [ more, setMore ] = useState(0);
    const [ pageOffset, setPageOffset ] = useState(calculatePageOffset(offset, limit));
    const [ pageCount, setPageCount ] = useState(total, limit);

    useEffect(() => {
        updateData(limit, offset, sort);
    }, [limit, offset, sort]);


    function defaultLimit() {
        return parseInt(args.get("limit")) || 25;
    }

    function defaultOffset() {
        return parseInt(args.get("offset")) || 0;
    }

    function defaultSort() {
        return args.get("sort") || "";
    }

    function calculatePageOffset(offset, limit) {
        return Math.ceil(offset / limit);
    }

    function calculatePageCount(total, limit) {
        return Math.ceil(total / limit);
    }

    function updateData(limit, offset, sort) {
        if (!Type.IsInteger(limit))  limit  = defaultLimit();
        if (!Type.IsInteger(offset)) offset = defaultOffset();
        if (!Str.HasValue(sort))     sort   = defaultSort();
		setArgs({...args, "limit": limit, "offset": offset, "sort": sort });
        function onDone(response) {
            const total = parseInt(response.get("paging.total"));
            const more = parseInt(response.get("paging.more"));
            if (limit > total) {
                setOffset(0);
            }
            setTotal(total);
            setMore(more);
            setPageCount(calculatePageCount(total, limit));
            setPageOffset(calculatePageOffset(offset, limit));
        }
        update(limit, offset, sort, onDone);
    }

    function onPageSize(event) {
        //
        // If the page size changes got back to the first page.
        // Seem to have to reload the entire page to get the PaginationComponent page offset to update;
        // the underlying react-paginate component does not update its (internal) page offset component
        // unless it is done directly using its own UI state.
        //
        const limit = parseInt(event.target.value);
        if (offset > 0) {
		    setArgs({...args, "limit": limit, "offset": 0 });
            window.location.reload();
        }
        else {
            setLimit(limit);
        }
    }

    function onPageOffset(event) {
        const pageOffset = event.selected;
        const offset = pageOffset * limit;
        setOffset(offset);
    }

    function onSort(key, order) {
        setSort(`${key}.${order}`);
    }

    return <>
        <table style={{width:"100%"}} border="0"><tbody><tr><td style={{width:"90%"}}>
            <PaginationComponent
                pages={pageCount}
                page={pageOffset}
                onChange={onPageOffset}
                loading={data?.loading}
                spinner={true} />
            </td><td style={{align:"right",paddingTop:"6pt",fontSize:"9pt",fontWeight:"bold",color:Styles.GetForegroundColor(),whiteSpace:"nowrap"}}>
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
                  <span>More: {more}&nbsp;|&nbsp;</span>
                  <span>Total: {total}&nbsp;</span>
            </td></tr></tbody></table>
            <div className="box" style={{marginTop:"4pt",paddingTop:"8pt"}}>
            <table style={{width:"100%"}}>
                <TableHead
                    columns={columns}
                    sort={sort}
                    list={data?.get("list")}
                    update={onSort}
                    bottomline={true}
                    style={{color:Styles.GetForegroundColor(),fontWeight:"bold"}}
                    loading={data?.loading} />
                <tbody>
                    {children}
                </tbody>
            </table>
        </div>
    </>
};

export default PagedTableComponent;
