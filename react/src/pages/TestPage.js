import { Component } from 'react';
import Styles from '../Styles';
import Server from '../utils/Server';
import { useFetch } from '../utils/Fetch';

const TestPage = () => {

    const fetch = useFetch(Server.Url("/header"));
        console.log('TEST-PAGE-AFTER-FETCH-HOOK:')

        return <>
                <pre> LOADING: {fetch.loading ? 'YES' : 'NO'} </pre>
                <pre> STATUS: {fetch.status} </pre>
                <pre> TIMEOUT: {fetch.timeout ? 'YES' : 'NO'} </pre>
                <pre> ERROR: {fetch.error} </pre>
                <pre> RESPONSE: {JSON.stringify(fetch.data, null, 2)} </pre>
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
        </>;
}

export default TestPage;
