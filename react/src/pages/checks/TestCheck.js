// REWRITE IN PROGRESS | NOT YET IN USE | 2022-12-27
// PURPOSE IS TO ALLOW EASILY PLOPPING THIS ON ANY PAGE.

import React from 'react';
import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StandardSpinner } from '../../Spinners';
import { useFetch } from '../../utils/Fetch';
import { ExternalLink, GitHubLink } from '../../Components';
import Char from '../../utils/Char';
import CheckWithFetch from './CheckWithFetch';
import Clipboard from '../../utils/Clipboard';
import Client from '../../utils/Client';
import Env from '../../utils/Env';
import Image from '../../utils/Image';
import Json from '../../utils/Json';
import Str from '../../utils/Str';
import Time from '../../utils/Time';
import Tooltip from '../../components/Tooltip';
import Type from '../../utils/Type';
import Yaml from '../../utils/Yaml';
import Uuid from 'react-uuid';
import { useComponentDefinitions, useSelectedComponents } from '../../Hooks.js';
import useKeyedState from '../../hooks/KeyedState';

const background = "lightyellow";

const TestCheck = (props) => {

    let { environ } = useParams();
    const checkBoxState = useKeyedState();
    const [ show, setShow ] = useState(true);
    const checkName =  "elastic_search_space";
    //const checkName =  "biorxiv_is_now_published"; // "elastic_search_space";
    //const checkName2 =  "mcoolqc_status"; // "elastic_search_space";
    //const checkName =  "pairsqc_status"; // "elastic_search_space";
    //const checkName =  "find_cypress_test_items_to_purge"; // "elastic_search_space";
    //const checkName2 =  "pairsqc_status"; // "elastic_search_space";
    const [ showHistory, setShowHistory ] = useState(true);

    return <>
        { show ? <>
            <span className="pointer" onClick={() => setShow(value => !value)}>Hide Check</span>
                &nbsp;|&nbsp;
                <span style={{cursor:"pointer"}} onClick={() => setShowHistory(!showHistory)}>
                    { showHistory ? <>
                        Hide History
                    </>:<>
                        Show History
                    </>}
                </span>
            <CheckWithFetch
                checkName={checkName}
                env={environ}
                parentState={checkBoxState.keyed(checkName)}
                showRunBox={false}
                showLatestResult={true}
                showHistory={showHistory}
                setShowHistory={setShowHistory}
                showStandaloneCheckPageLink={true} />
                {/*
            <CheckWithFetch
                checkName={checkName2}
                env={environ}
                parentState={checkBoxState.keyed(checkName2)}
                showHistory={showHistory}
                setShowHistory={setShowHistory}
                showStandaloneCheckPageLink={true} />
                */}
        </>:<>
            <span className="pointer" onClick={() => setShow(value => !value)}>Show Check</span>
        </>}
        { showHistory && <>
            <br />
            <div className="box">
                This represents the check history box.
            </div>
        </> }
            <br />
        <pre>{Json.Format(checkBoxState.__get())}</pre>
    </>
}

export default TestCheck;
