import ReactPaginate from 'react-paginate';
import Char from './utils/Char';
import { ScaleSpinner } from './Spinners';
import Styles from './Styles';

export const PaginationComponent = ({ pages, page, onChange, refresh, loading, spinner }) => {
    //
    // This double div with not-allowed cursor pointer-events none when disabled
    // is necessary as if putting them in one the cursor will not take. 
    //
    return <table><tbody><tr><td>
       <div style={{cursor:loading ? "not-allowed" : ""}}>
            <div style={{pointerEvents:loading ? "none" : "", opacity:loading ? "0.4" : "",fontSize:"8pt",fontWeight:"bold"}} className={"pagination-control"}>
                <ReactPaginate
                    nextLabel="NEXT"
                    onPageChange={onChange}
                    pageRangeDisplayed={2}
                    initialPage={page}
                    disableInitialCallback={true}
                    marginPagesDisplayed={2}
                    pageCount={pages}
                    previousLabel="PREV"
                    pageClassName="pagination"
                    pageLinkClassName="page-link"
                    previousClassName="page-link"
                    previousLinkClassName="page-link"
                    nextClassName="page-item"
                    nextLinkClassName=" page-link"
                    breakLabel="..."
                    breakClassName="page-item"
                    breakLinkClassName="page-link"
                    containerClassName="pagination"
                    activeClassName="active"
                    renderOnZeroPageCount={null} />
            </div>
        </div>
        </td>
        { refresh &&
            <td>
                <span style={{cursor:"pointer"}} onClick={refresh}>
                    <span style={{border:"1px solid lightgray",borderRadius:"3px",marginLeft:"6pt",padding:"1pt 4pt 1pt 4pt",fontSize:"14pt",cursor:"pointer"}}>
                        <b>{Char.Refresh}</b>
                    </span>
                </span>
            </td>
        }
        { spinner &&
           <td style={{whiteSpace:"nowrap",paddingLeft:"6pt",paddingBottom:"2pt"}}>
                { loading && <ScaleSpinner label="" condition={true||loading} width="3px" height="20px" color={Styles.GetForegroundColor()} /> }
           </td>
       }
   </tr></tbody></table>
}

export default PaginationComponent;
