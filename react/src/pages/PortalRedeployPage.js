import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Char from '../utils/Char'; 
import DateTime from '../utils/DateTime';
import Duration from '../utils/Duration';
import { ExternalLink } from '../Components'; 
import Image from '../utils/Image';
import Json from '../utils/Json';
import { PuffSpinnerInline, StandardSpinner } from '../Spinners';
import Tooltip from '../components/Tooltip';
import useFetch from '../hooks/Fetch';
import useFetchFunction from '../hooks/FetchFunction';
import useHeader from '../hooks/Header';
import Yaml from '../utils/Yaml';

const region = "us-east-1";

const PortalRedeployPage = (props) => {

    const clusterArn = "c4-ecs-blue-green-smaht-production-stack-SmahtProductiongreen-vqC6hBVe1hLv"
    const [args, setArgs] = useSearchParams();

    const services = useFetch(`//aws/ecs/services_for_update/${clusterArn}`);

    return <>
        <div className="container">
            <div>
                <b style={{fontSize: "x-large"}}>Portal Redeploy</b>
            </div>
            { services.loading ?
                <ContentLoading />
            : <>
                <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
                    <pre style={{background: "inherit"}}>
                        {Yaml.Format(services.data)}
                    </pre>
                </div>
            </> }
        </div>
    </>
}

const ContentLoading = (props) => {
    return <div className="box thickborder" style={{marginTop: "2pt", marginBottom: "10pt"}}>
        <StandardSpinner />
    </div>
}

export default PortalRedeployPage;
