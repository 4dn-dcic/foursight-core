import ReactPaginate from 'react-paginate';
import { ScaleSpinner } from './Spinners';

export const PaginationControl = (props) => {
    //
    // This double div with not-allowed cursor pointer-events none when disabled
    // is necessary as if putting them in one the cursor will not take. 
    //
    return <table><tbody><tr><td>
           <div style={{cursor:props.loading ? "not-allowed" : ""}}>
                <div style={{pointerEvents:props.loading ? "none" : "", opacity:props.loading ? "0.4" : "",fontSize:"8pt",fontWeight:"bold"}} className={"pagination-control"}>
                    <ReactPaginate
                        nextLabel="NEXT"
                        onPageChange={props.onChange}
                        pageRangeDisplayed={2}
                        initialPage={props.page}
                        disableInitialCallback={true}
                        marginPagesDisplayed={2}
                        pageCount={props.pages}
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
           { props.spinner &&
               <td style={{whiteSpace:"nowrap",paddingLeft:"6pt",paddingBottom:"2pt"}}>
                    { props.loading && <ScaleSpinner label="" condition={true||props.loading} width="3px" height="20px" color="darkblue" /> }
               </td>
           }
           </tr></tbody></table>
}

export default PaginationControl;
