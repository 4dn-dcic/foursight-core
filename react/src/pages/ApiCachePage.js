import { useState } from 'react';
import Char from '../utils/Char';
import { HorizontalLine } from '../Components';
import Server from '../utils/Server';
import useFetch from '../hooks/Fetch';
import Json from '../utils/Json';
import Yaml from '../utils/Yaml';

const tdstyle = { fontSize: "11pt", verticalAlign: "top", paddingBottom: "2pt", paddingRight: "10pt", whiteSpace: "nowrap" };

const ApiCache = (props) => {
    const cache = props.cache
    return <>
        <tr>
            <td style={tdstyle}>{cache.function}</td>
            <td style={tdstyle}>{cache.hits}</td>
            <td style={tdstyle}>{cache.misses}</td>
            <td style={tdstyle}>{cache.size}</td>
            <td style={tdstyle}>{cache.updated}</td>
            <td style={tdstyle}>
                { cache.maxsize >= Number.MAX_SAFE_INTEGER ? <>
                    &#x221E;
                </>:<>
                    {cache.maxsize}
                </> }
            </td>
            <td style={tdstyle}>{cache.ttl || <>&ndash;</>}</td>
            <td style={tdstyle}>{cache.ttl_none || <>&ndash;</>}</td>
            <td style={tdstyle}>{cache.nocache_none ? <>Yes</> : <>No</>}</td>
        </tr>
    </>
}

const ApiCachePage = (props) => {

    const apiCache = useFetch(Server.Url("/__functioncache__", false));
    const [ showJson, setShowJson ] = useState(false);

    const thstyle = { ...tdstyle, fontWeight: "bold", textDecoration: "underline" };
    return <>
        <div>
            &nbsp;<b>API Cache</b>&nbsp;
            <span onClick={() => setShowJson(!showJson)} className="pointer">
                { showJson ? <>
                    {Char.DownArrowFat}
                </>:<>
                    {Char.UpArrowFat}
                </> }
            </span>
        </div>
        <div className="box margin" style={{width:"fit-content"}}>
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
                        <td style={thstyle}>No Cache None</td>
                    </tr>
                </thead>
                <tbody>
                    { apiCache.map(item =>
                        <ApiCache cache={item} key={item.function}/>
                    )}
                </tbody>
            </table>
            { showJson && <>
                <HorizontalLine top={"4pt"} bottom={"4pt"} />
                <pre style={{background:"inherit", color: "inherit", marginTop:"2pt",whiteSpace:"pre-wrap"}}>
                    {Json.Format(apiCache.data)}
                </pre>
            </> }
        </div>
    </>
};

export default ApiCachePage;
