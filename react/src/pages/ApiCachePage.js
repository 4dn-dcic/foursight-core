import { useState } from 'react';
import Char from '../utils/Char';
import { HorizontalLine } from '../Components';
import Server from '../utils/Server';
import useFetch from '../hooks/Fetch';
import useFetcher from '../hooks/Fetcher';
import useFetchFunction from '../hooks/FetchFunction';
import Json from '../utils/Json';
import Yaml from '../utils/Yaml';

const tdstyle = { fontSize: "11pt", verticalAlign: "top", paddingBottom: "2pt", paddingRight: "10pt", whiteSpace: "nowrap" };
const tdstyler = { ...tdstyle, textAlign: "right" };

const ApiCache = (props) => {
    const cache = props.cache
    const fetch = useFetchFunction();
    function clearCache(functionName) {
        fetch(`//__functioncacheclear__?name=${functionName}`)
        props.refresh();
    }
    return <>
        <tr>
            <td style={tdstyle}>{cache.function}</td>
            <td style={tdstyler}>{cache.hits}</td>
            <td style={tdstyler}>{cache.misses}</td>
            <td style={tdstyler}>{cache.size}</td>
            <td style={tdstyle}>{cache.updated || <>&ndash;</>}</td>
            <td style={tdstyler}>
                { cache.maxsize >= Number.MAX_SAFE_INTEGER ? <>
                    {Char.Infinity}
                </>:<>
                    {cache.maxsize}
                </> }
            </td>
            <td style={tdstyler}>{cache.ttl || <>&ndash;</>}</td>
            <td style={tdstyler}>{cache.ttl_none || <>&ndash;</>}</td>
            <td style={tdstyle}>{cache.nocache_none ? <>No</> : <>Yes</>}</td>
            <td style={tdstyle}>
                <span onClick={() => clearCache(cache.function)} className="pointer">Clear</span>
            </td>
        </tr>
    </>
}

const ApiCachePage = (props) => {

    const cache = useFetch("//__functioncache__");
    const fetch = useFetchFunction();
    const [ showJson, setShowJson ] = useState(false);
    const thstyle = { ...tdstyle, fontWeight: "bold", textDecoration: "underline" };

    function refresh() {
        cache.refresh();
    }

    function clear() {
        fetch("//__functioncacheclear__");
        refresh();
    }

    return <div style={{width:"fit-content"}}>
        <div>
            &nbsp;<b>API Cache</b>&nbsp;
            <small style={{float: "right", marginTop: "2pt"}}><b>
                <span onClick={clear} className="pointer">Clear All</span>
                &nbsp;|&nbsp;
                <span onClick={refresh} className="pointer">Refresh</span>
                &nbsp;|&nbsp;
                <span onClick={() => setShowJson(!showJson)} className="pointer">
                    JSON&nbsp;
                    { showJson ? <>
                        {Char.DownArrowFat}
                    </>:<>
                        {Char.UpArrowFat}
                    </> }
                </span>
                &nbsp;
            </b></small>
        </div>
        <div className="box margin">
            <table>
                <thead>
                    <tr>
                        <td style={thstyle}>Function</td>
                        <td style={thstyle}>Hits</td>
                        <td style={thstyle}>Misses</td>
                        <td style={thstyle}>Size</td>
                        <td style={thstyle}>Updated</td>
                        <td style={thstyle}>Max Size</td>
                        <td style={thstyle}>TTL</td>
                        <td style={thstyle}>TTL None</td>
                        <td style={thstyle}>Cache None</td>
                        <td style={thstyle}>Action</td>
                    </tr>
                </thead>
                <tbody>
                    { cache.map(item =>
                        <ApiCache cache={item} key={item.function} refresh={refresh} />
                    )}
                </tbody>
            </table>
            { showJson && <>
                <HorizontalLine top={"4pt"} bottom={"4pt"} />
                <pre style={{background:"inherit", color: "inherit", marginTop:"2pt",whiteSpace:"pre-wrap"}}>
                    {Json.Format(cache.data)}
                </pre>
            </> }
        </div>
    </div>
};

export default ApiCachePage;
