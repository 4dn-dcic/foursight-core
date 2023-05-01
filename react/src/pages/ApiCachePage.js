import { useState } from 'react';
import Char from '../utils/Char';
import { HorizontalLine } from '../Components';
import Server from '../utils/Server';
import Json from '../utils/Json';
import Tooltip from '../components/Tooltip';
import Yaml from '../utils/Yaml';
import useFetch from '../hooks/Fetch';
import useFetcher from '../hooks/Fetcher';
import useFetchFunction from '../hooks/FetchFunction';

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
            <td style={tdstyle}>{cache.name}</td>
            <td style={tdstyler}>{cache.hits > 0 ? cache.hits : <>&ndash;</>}</td>
            <td style={tdstyler}>{cache.misses > 0 ? cache.misses : <>&ndash;</>}</td>
            <td style={tdstyler}>{cache.size > 0 ? cache.size : <>&ndash;</>}</td>
            <td style={tdstyle} id={`tooltip-updated-${cache.name}`}>
                <Tooltip id={`tooltip-updated-${cache.name}`} position="bottom" text={"Last time function was actually called."} />
                {cache.updated || <>&ndash;</>}
            </td>
            <td style={tdstyler} id={`tooltip-duration-${cache.name}`}>
                <Tooltip id={`tooltip-duration-${cache.name}`} position="bottom" text={"Duration of last actual function call."} />
                {cache.duration ? (cache.duration?.toFixed(1) + ' ms') : <>&ndash;</>}
            </td>
            <td style={tdstyler}>
                { cache.maxsize >= Number.MAX_SAFE_INTEGER ? <>
                    {Char.Infinity}
                </>:<>
                    {cache.maxsize}
                </> }
            </td>
            <td style={tdstyler}>{cache.ttl || <>&ndash;</>}</td>
            <td style={tdstyler}>{cache.ttl_none || <>&ndash;</>}</td>
            <td style={tdstyle}>{cache.nocache_none ? <>Yes</> : <>&ndash;</>}</td>
            <td style={tdstyle}>{cache.nocache_other ? <>Yes</> : <>&ndash;</>}</td>
            <td style={tdstyle}>
                <span onClick={() => clearCache(cache.name)} className="pointer">Clear</span>
            </td>
        </tr>
    </>
}

const ApiCachePage = (props) => {

    const cache = useFetch("//__functioncache__");
    const fetch = useFetchFunction();
    const [ showJson, setShowJson ] = useState(false);
    const thstyle = { ...tdstyle, verticalAlign: "bottom", fontWeight: "bold", textDecoration: "underline" };

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
                        <td style={thstyle}>Name</td>
                        <td style={thstyle}>Hits</td>
                        <td style={thstyle}>Misses</td>
                        <td style={thstyle}>Size</td>
                        <td style={thstyle}>Updated</td>
                        <td style={thstyle}>Duration</td>
                        <td style={thstyle}>Max Size</td>
                        <td style={thstyle}>TTL</td>
                        <td style={thstyle}>TTL None</td>
                        <td style={thstyle}>Null<br />NoCache</td>
                        <td style={thstyle}>Other<br />NoCache</td>
                        <td style={thstyle}>Action</td>
                    </tr>
                </thead>
                <tbody>
                    { cache.map(item =>
                        <ApiCache cache={item} key={item.name} refresh={refresh} />
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
