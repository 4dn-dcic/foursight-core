// import Styles from '../Styles';
import Server from '../utils/Server';
import { useFetch, useFetching, useFetched } from '../utils/Fetch';

const TestPage = () => {

    const [ mainFetchResponse, mainFetchFunction ] = useFetch(Server.Url("/header"));
    const [ someFetchResponse, someFetchFunction ] = useFetch(Server.Url("/header"), { nofetch: true, nologout: true, delay: 7 * 1000 });
    const [ fetching ] = useFetching();
    const [ fetched ] = useFetched();

    return <>
        <div><span className="cursor-hand" onClick={() => mainFetchFunction()}>MAIN-FETCH</span>&nbsp;|&nbsp;
             <span className="cursor-hand" onClick={() => someFetchFunction()}>SOME-FETCH</span></div>
        <div>
            <div style={{float:"left"}}>
                <pre> FETCHING: {JSON.stringify(fetching, null, 2)} </pre>
                <pre> FETCHED : {JSON.stringify(fetched, null, 2)} </pre>
            </div>
            <div style={{float:"left",marginLeft:"10pt"}}>
                <pre> MAIN-FETCH-LOADING: {mainFetchResponse.loading ? 'YES' : 'NO'} </pre>
                <pre> MAIN-FETCH-STATUS: {mainFetchResponse.status} </pre>
                <pre> MAIN-FETCH-TIMEOUT: {mainFetchResponse.timeout ? 'YES' : 'NO'} </pre>
                <pre> MAIN-FETCH-ERROR: {mainFetchResponse.error} </pre>
                <pre> MAIN-RESPONSE: {JSON.stringify(mainFetchResponse.data, null, 2)} </pre>
            </div>
            <div style={{float:"left",marginLeft:"10pt"}}>
                <pre> SOME-FETCH-LOADING: {someFetchResponse.loading ? 'YES' : 'NO'} </pre>
                <pre> SOME-FETCH-STATUS: {someFetchResponse.status} </pre>
                <pre> SOME-FETCH-TIMEOUT: {someFetchResponse.timeout ? 'YES' : 'NO'} </pre>
                <pre> SOME-FETCH-ERROR: {someFetchResponse.error} </pre>
                <pre> SOME-RESPONSE: {JSON.stringify(someFetchResponse.data, null, 2)} </pre>
            </div>
        </div>
{/*
            <div>
                <span onClick={() => Styles.SetFoursightFourfront()}>SET FOURSIGHT-FOURFRONT STYLES</span> <br />
                <span onClick={() => Styles.SetFoursightCgap()}>SET FOURSIGHT-CGAP STYLES</span> <br />
                    <div className="box border-thick darkened">
                        foo
                    </div>
                    <div className={"vspace-medium"} />
                <div className="box border">
                    Hello, world!
                    <div className="box lightened border mono">
                        Lightened
                    </div>
                    <div className="hline" />
                    <div className="box darkened border">
                        Darkened
                    </div>
                    <div className={"vspace-normal"} />
                </div>
                <span>Hello, world!</span>
            </div>
*/}
        </>;
}

export default TestPage;
