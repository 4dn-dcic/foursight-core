import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Uuid from 'react-uuid';
import { RingSpinner, PuffSpinnerInline, StandardSpinner } from '../Spinners';
import { useReadOnlyMode } from '../ReadOnlyMode';
import { useFetch, useFetchFunction } from '../utils/Fetch';
import { FetchErrorBox, RefreshButton } from '../Components';
import Char from '../utils/Char';
import Clipboard from '../utils/Clipboard';
import Client from '../utils/Client';
import Env from '../utils/Env';
import Image from '../utils/Image';
import Json from '../utils/Json';
import Server from '../utils/Server';
import Str from '../utils/Str';
import TableHead from '../TableHead';
import Time from '../utils/Time';
import Type from '../utils/Type';
import Yaml from '../utils/Yaml';
import Styles from '../Styles';
import NetworkInfoComponent from './NetworkInfoComponent';

const NetworkInfoPage = (props) => {

    const [ refreshing, setRefreshing ] = useState(false);

    // This is to be set by the callee, i.e. NetworkInfoComponent, to allow refresh from the outside here.
    const caller = {
        refresh: () => {},
    }

    function refresh() {
        caller.refresh();
    }

    return <div className="container">
        <div>
            <RefreshButton style={{float:"right",marginRight:"2pt",marginTop:"-2pt"}} refresh={refresh} refreshing={refreshing} />
            <b>AWS Network Information</b>
        </div>
        <NetworkInfoComponent caller={caller} setRefreshing={setRefreshing} />
    </div>
}

export default NetworkInfoPage;
