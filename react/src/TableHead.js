import UUID from './utils/UUID';

const TableHead = ({columns, list, update, style}) => {
    function sort(list, field, direction) {
        let comparator = direction > 0
                       ? (a,b) => a[field] > b[field] ? 1 : (a[field] < b[field] ? -1 : 0)
                       : (a,b) => a[field] < b[field] ? 1 : (a[field] > b[field] ? -1 : 0);
        list = list.sort((a,b) => comparator(a, b));
        return list;
    }
    if (!list.__sort) list.__sort = { key: "key", order: 1 };
    return <thead><tr>
        { columns.map((column) => {
            return <td key={UUID()} style={{textAlign:column.align || "normal"}}>
                { column.key ? (<>
                    <span style={{...style, cursor:"pointer"}}
                        onClick={() => {
                            list.__sort.key = column.key;
                            list.__sort.order = -list.__sort.order;
                            sort(list, list.__sort.key, list.__sort.order);
                            update();
                        }}>
                        <span style={{...style}}>{column.label}</span>
                        { list.__sort.key == column.key ? (<>
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

export default TableHead;
