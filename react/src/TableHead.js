import TYPE from './utils/TYPE';
import UUID from './utils/UUID';

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
// and the key is the name of the field in the given list to sort on.
//
// The implementation is slightly trickier than one might expect (and not generally done right by
// examples in the wild) because it needs to work for multiple components repeated within a loop,
// where using useState (for sort state) for each is problematic as gets reset on each invocation.
// So we stored the sort state in hidden fields within the given list itself.
// -------------------------------------------------------------------------------------------------

const TableHead = ({columns, list, update, state, style}) => {
    function sort(list, key, direction) {
        let comparator = TYPE.IsFunction(key)
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
        return (TYPE.IsFunction(a) && TYPE.IsFunction(b)) ? a.name == b.name : a == b;
    }
    if (!list.__sort) list.__sort = state || { key: null, order: 0 };
    return <thead><tr>
        { columns.map(column => {
            return <td key={UUID()} style={{textAlign:column.align || "normal"}}>
                { column.key ? (<>
                    <span style={{...style, cursor:"pointer"}}
                        onClick={() => {
                            list.__sort.key = column.key;
                            list.__sort.order = list.__sort.order ? -list.__sort.order : 1;
                            sort(list, list.__sort.key, list.__sort.order);
                            update();
                        }}>
                        <span style={{...style}}>{column.label}</span>
                        { keysEqual(list.__sort.key, column.key) ? (<>
                            <span style={{fontWeight:"normal"}}>&nbsp;{list.__sort.order > 0 ? <>&#x2193;</> : <>&#x2191;</>}</span>
                        </>):(<>
                            &nbsp;<span style={{position:"relative",fontSize:"7pt",top:"-2pt"}}>&#x2022;</span>
                        </>)}
                    </span>
                </>):(<>
                    <span style={{...style}}>{column.label}</span>
                </>)}
            &nbsp;&nbsp;</td>
        })}
    </tr></thead>
}

// -------------------------------------------------------------------------------------------------
// Exported component.
// -------------------------------------------------------------------------------------------------

export default TableHead;
