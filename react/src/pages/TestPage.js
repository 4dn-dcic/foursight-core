// -------------------------------------------------------------------------------------------------
// PLEASE IGNORE THIS PAGE!
// THIS WILL GO AWAY - IT IS A LITTLE SANDBOX FOR GENERAL REACT EXPERIMENTATION
// -------------------------------------------------------------------------------------------------

// import Styles from '../Styles';
import { useEffect } from 'react';
import Server from '../utils/Server';
import { useFetch, useFetching, useFetched } from '../utils/Fetch';
import uuid from 'react-uuid';
import XyzzyComponent from './XyzzyComponent';

/*
const XyzzyComponent = () => {
    const xyzzy = useFetch(Server.Url("/info"));
     useEffect(() => {
        xyzzy.refresh(Server.Url("/header"));
     }, []);
    return <pre>XYZZY: {JSON.stringify(xyzzy)}</pre>
}
*/

const TestSub = () => {
        return <>
            <XyzzyComponent />
        </>
}

const TestPage = () => {
    
 // const info = useFetch(Server.Url("/checks"));
    const someFetchResponse = useFetch({
        url: Server.Url("/header"),
        onData: (data) => {
        },
        nofetch: true,
        nologout: true,
        delay: 1.0 * 1000
    });

        useEffect(() => {
                console.log('use-effect');
        }, []);

    const mainFetchResponse = useFetch(Server.Url("/header"), { nofetch: true });
    const [ fetching ] = useFetching();
    const [ fetched ] = useFetched();

    return <>
                <TestSub/>
        <div><span className="cursor-hand" onClick={() => mainFetchResponse.refresh()}>MAIN-FETCH</span>&nbsp;|&nbsp;
             <span className="cursor-hand" onClick={() => someFetchResponse.refresh()}>SOME-FETCH</span>&nbsp;|&nbsp;
             <span className="cursor-hand"
                onClick={() => {
                    if (someFetchResponse.data?.app) someFetchResponse.data.app.title = uuid();
                    someFetchResponse.update();
                }}>UPDATE-SOME-DATA</span>&nbsp;|&nbsp;
             <span className="cursor-hand"
                onClick={() => {
                    someFetchResponse.refresh({
                            url: Server.Url("/users"),
                            timeout: 2000,
                        onData: (data, currentData) => {
                            console.log('refresh.ondone');
                            console.log(currentData)
                            console.log(data)
                        }
                    });
                }}>REFRESH-SOME-DATA</span>
        </div>
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
