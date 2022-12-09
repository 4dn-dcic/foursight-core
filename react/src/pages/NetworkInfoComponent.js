import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Uuid from 'react-uuid';
import { RingSpinner, PuffSpinnerInline, StandardSpinner } from '../Spinners';
import { useReadOnlyMode } from '../ReadOnlyMode';
import { useFetch, useFetchFunction } from '../utils/Fetch';
import { FetchErrorBox } from '../Components';
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

const VpcPanel = (props) => {

    const vpcs = useFetchVpcs();

    function useFetchVpcs(refresh = false) {
        return useFetch({ url: Server.Url(`/aws/vpcs`), nofetch: true, cache: true });
    }

    function fetchVpcs(refresh = false) {
        vpcs.fetch({ nocache: refresh });
    }

    function refreshVpcs() {
        fetchVpcs(true);
    }

    useEffect(() => {
        fetchVpcs();
    }, []);

    return <>
        <div className="box">
            {vpcs.map((vpc, i) =>
                <b>{vpc.name}</b>
            )}
        </div>
    </>
}

const NetworkInfoComponent = (props) => {

    const networkInfo = useFetchNetworkInfo();

    function useFetchNetworkInfo(refresh = false) {
        return useFetch({ url: Server.Url(`/aws/network`), nofetch: true, cache: false });
    }

    function fetchNetworkInfo(refresh = false) {
        props.setRefreshing(true);
        networkInfo.fetch({ nocache: refresh, onDone: () => props.setRefreshing(false) });
    }

    function refreshNetworkInfo() {
        fetchNetworkInfo(true);
    }

    useEffect(() => {
        //fetchNetworkInfo();
    }, []);

    props.caller.refresh = refreshNetworkInfo;

    return <div>
        <VpcPanel />
    </div>
}

export default NetworkInfoComponent;
