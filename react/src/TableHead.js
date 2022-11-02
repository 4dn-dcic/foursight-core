import React from 'react';
import Uuid from 'react-uuid';
import Char from './utils/Char';
import Type from './utils/Type';
import { PuffSpinner } from './Spinners';

// -------------------------------------------------------------------------------------------------
// Nice little table header component with sorting for columns (and with up/down arrow indicators).
// Pass in: a list (array) which is the contents of the table which will be sorted when the column
// header is clicked; a columns array containing info about the columns to be sorted on and which
// looks like the below example; and an update function which will be called after the sorting is
// performed on the given list (which should update the React state to reflect the sorting).
// Styles on the displayed header text may also be passed in.
//
//  [ { label: "Name", key: "key" },
//    { label: "Size (MB)", key: "size", align: "right" },
//    { label: "Last Modified", key: "modified" } ]
//
// In the (above example) columns array the label is the displayed header text,
// and the key is the name of the field in the given list to sort on; this key
// can alternatively be a function which (if so) will be called with the item
// in the list to sort and which should return the corresponding value.
//
// The implementation is slightly trickier than one might expect (and not generally done right by
// examples in the wild) because it needs to work for multiple components repeated within a loop,
// where using useState (for sort state) for each is problematic as gets reset on each invocation.
// So we stored the sort state in hidden fields within the given list itself.
// -------------------------------------------------------------------------------------------------

const TableHead = ({columns, list, update, state = null, lines = false, style = {}, spinner = false, loading = false, children}) => {
    function sort(list, key, direction) {
        let comparator = Type.IsFunction(key)
                         ? (direction > 0
                            ? (a,b) => key(a) > key(b) ? 1 : (key(a) < key(b) ? -1 : 0)
                            : (a,b) => key(a) < key(b) ? 1 : (key(a) > key(b) ? -1 : 0))
                          : (direction > 0
                             ? (a,b) => a[key] > b[key] ? 1 : (a[key] < b[key] ? -1 : 0)
                             : (a,b) => a[key] < b[key] ? 1 : (a[key] > b[key] ? -1 : 0));
        list = list.sort((a,b) => comparator(a, b));
        return list;
    }
    function keysEqual(a, b) {
        return (Type.IsFunction(a) && Type.IsFunction(b)) ? a.name === b.name : a === b;
    }
    if (!list.__sort) {
        if (state) {
            list.__sort = state;
            const sortKey = Type.IsFunction(list.__sort.key) ? list.__sort.key(null) : list.__sort.key;
            const sortOrder = list.__sort.order > 0 ? "asc" : "desc";
            update(sortKey, sortOrder);
        }
        else {
            list.__sort = { key: null, order: 0 };
        }
    }
    return <thead>
        { lines && <><tr><td style={{height:"1px",background:style?.color ? style.color : "gray"}} colSpan="9"></td></tr>
                     <tr><td style={{paddingBottom:"2pt"}}></td></tr></>}
        <tr>{ columns.map(column => {
            return <td key={Uuid()} style={{textAlign:column.align || "normal",whiteSpace:"nowrap"}}>
                { column.key ? (<>
                    <span style={{...style, cursor: loading ? "not-allowed" : "pointer"}}
                        onClick={() => {
                            //
                            // TODO
                            // Don't pass anonymous function here, and (lotsa places) elsewhere ...
                            // https://user3141592.medium.com/react-gotchas-and-best-practices-2d47fd67dd22
                            //
                            if (loading) return;
                            list.__sort.key = column.key;
                            list.__sort.order = list.__sort.order ? -list.__sort.order : 1;
                            sort(list, list.__sort.key, list.__sort.order);
                            const sortKey = Type.IsFunction(list.__sort.key) ? list.__sort.key(null) : list.__sort.key;
                            const sortOrder = list.__sort.order > 0 ? "asc" : "desc";
                            update(sortKey, sortOrder);
                        }}>
                        <table cellPadding="0" cellSpacing="0" style={{margin:"0",padding:"0",display:"inline-block"}}><tbody style={{margin:"0",padding:"0"}}><tr style={{margin:"0",padding:"0"}}>
                        { keysEqual(list.__sort.key, column.key) ? (<>
                            <td>
                                <span style={{...style}}>{column.label}</span>
                                { !loading && <span style={{fontWeight:"normal"}}>&nbsp;{list.__sort.order > 0 ? <>{Char.DownArrow}</> : <>{Char.UpArrow}</>}</span> }
                            </td>
                            <td style={{paddingLeft:"3pt",paddingTop:"2pt"}}>
                                { loading && <><PuffSpinner condition={true} size={"16px"}/></> }
                            </td>
                        </>):(<>
                            <td >
                                <span style={{...style}}>{column.label}</span>
                                <div style={{position:"relative",top:"-1pt",display:"inline-block",fontSize:"7pt",opacity:"0.5"}}>&nbsp;{Char.Dot}</div>
                            </td>
                        </>)}
                        </tr></tbody></table>
                    </span>
                </>):(<>
                    <div style={{...style,display:"inline-block",position:"relative",top:"-1pt",cursor:"not-allowed"}}>{column.label}</div>
                </>)}
            &nbsp;&nbsp;</td>
        })}</tr>
        { lines && <><tr><td style={{paddingBottom:"0pt"}}></td></tr>
                      <tr><td style={{height:"1px",background:style?.color ? style.color : "red"}} colSpan="9"></td></tr>
                      <tr><td style={{height:"4pt"}} colSpan="6"></td></tr></>}
        {children}
    </thead>
}

// -------------------------------------------------------------------------------------------------
// Exported component.
// -------------------------------------------------------------------------------------------------

export default TableHead;
