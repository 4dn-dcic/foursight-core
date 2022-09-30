import ReactPaginate from 'react-paginate';
import { ScaleSpinner } from './Spinners';

export const PaginationControl = ({pages, onChange, page = 1, spinner = true, loading = false}) => {
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
                        previousClassName="color:red"
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
           { spinner &&
               <td style={{whiteSpace:"nowrap",paddingLeft:"6pt",paddingBottom:"2pt"}}>
                    { loading && <ScaleSpinner label="" condition={true||loading} width="3px" height="20px" color="darkblue" /> }
               </td>
           }
           </tr></tbody></table>
}

export default PaginationControl;
