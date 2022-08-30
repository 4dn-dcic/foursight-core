import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchData } from './FetchUtils';
import { RingSpinner } from "./Spinners";
import { LoginAndValidEnvRequired } from "./LoginUtils";
import * as API from "./API";
let YAML = require('json-to-pretty-yaml');

const CompareGacs = (props) => {

    const { environCompare } = useParams()
    const url = API.Url(`/gac/${environCompare}`, true);
    const [ data, setData ] = useState([]);
    let [ loading, setLoading ] = useState(true);
    let [ error, setError ] = useState(false);
    useEffect(() => { fetchData(url, setData, setLoading, setError)}, []);

    if (error) return <>Cannot load GAC comparison from Foursight: {error}</>;
    if (loading) return <>Loading content ...</>;
    return <LoginAndValidEnvRequired>
        <div className="container">
            <pre className="info">
                {YAML.stringify(data)}
            </pre>
        </div>
    </LoginAndValidEnvRequired>
};

export default CompareGacs;
