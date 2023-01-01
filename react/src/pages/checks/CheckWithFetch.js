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
import Check from './Check';
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
import { useKeyedState, useOptionalKeyedState } from '../../Hooks.js';

export const CheckWithFetch = (props) => {
    const { checkName, env, parentState, showRunBox, showLatestResult } = props;
    const check = useFetch(`/checks/${checkName}`, { cache: true });
    if (check.loading || !check.data) {
        return <div className="box" style={{width:props.width || "500pt"}}>
            <StandardSpinner label="Loading check" />
        </div>
    }
    return <>
        <Check
            check={check.data}
            env={env}
            parentState={parentState}
            showRunBox={showRunBox}
            showLatestResult={showLatestResult}
            showHistory={props.showHistory}
            setShowHistory={props.setShowHistory}
            showStandaloneCheckPageLink={props.showStandaloneCheckPageLink}
            width={props.width} />
    </>
}

export default CheckWithFetch;
