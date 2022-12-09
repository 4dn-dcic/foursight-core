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

const VpcBox = (props) => {

    const [ showingSubnets, setShowingSubnets ] = useState(false);
    const [ showingSecurityGroups, setShowingSecurityGroups ] = useState(false);

    function showSubnets()          { setShowingSubnets(true); }
    function hideSubnets()          { setShowingSubnets(false); }
    function toggleSubnets()        { showingSubnets ? setShowingSubnets(false) : setShowingSubnets(true); }
    function showSecurityGroups()   { setShowingSecurityGroups(true); }
    function hideSecurityGroups()   { setShowingSecurityGroups(false); }
    function toggleSecurityGroups() { showingSecurityGroups ? setShowingSecurityGroups(false) : setShowingSecurityGroups(true); }

    const tdLabelStyle = {
        fontWeight: "bold",
        fontSize: "small",
        paddingTop: "1pt",
        textAlign: "right",
        verticalAlign: "top",
        width: "5%",
        paddingRight: "4pt",
        whiteSpace: "nowrap"
    }
    const tdContentStyle = {
        verticalAlign: "top"
    }

    return <>
        <div className="box margin" style={{}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                VPC: <b>{props.vpc?.name}</b>
            </div>
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{props.vpc?.id}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>CIDR:</td>
                    <td>{props.vpc?.cidr}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Status:</td>
                    <td>{props.vpc?.state}</td>
                </tr>
                <tr onClick={toggleSubnets} className="pointer">
                    <td style={tdLabelStyle}>{showingSubnets ? Char.DownArrowHollow : Char.UpArrowHollow}&nbsp;Subnets:</td>
                    <td>
                        {showingSubnets ? <>
                            <span>Hide ({props.vpc?.subnets?.length})</span>
                            {props.vpc?.subnets.map(subnet => <div key={subnet.id}>
                                <SubnetBox subnet={subnet} />
                            </div>)}
                        </>:<>
                            <span>Show ({props.vpc?.subnets?.length})</span>
                        </>}
                    </td>
                </tr>
                <tr onClick={toggleSecurityGroups} className="pointer">
                    <td style={tdLabelStyle}>{showingSecurityGroups ? Char.DownArrowHollow : Char.UpArrowHollow}&nbsp;Security Groups:</td>
                    <td>
                        {showingSecurityGroups ? <>
                            <span>Hide ({props.vpc?.security_groups?.length})</span>
                            {props.vpc?.security_groups.map(security_group => <div key={security_group.id}>
                                <SecurityGroupBox security_group={security_group} />
                            </div>)}
                        </>:<>
                            <span>Show ({props.vpc?.security_groups?.length})</span>
                        </>}
                    </td>
                </tr>
            </tbody></table>
        </div>
    </>
}

const SubnetBox = (props) => {
    return <>
        <div className="box margin lighten" style={{width:"100%"}}>
            <b>{props.subnet.name}</b> <br />
            <b>{props.subnet.id}</b> <br />
        </div>
    </>
}

const SecurityGroupBox = (props) => {
    return <>
        <div className="box margin lighten" style={{width:"100%"}}>
            <b>{props.security_group?.name}</b> <br />
            <b>{props.security_group?.id}</b> <br />
        </div>
    </>
}

const NetworkInfoPage = (props) => {

    const vpcs = useFetchVpcs();

    function useFetchVpcs(refresh = false) {
        return useFetch({ url: Server.Url(`/aws/network/all`), nofetch: true, cache: true });
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
        <b>AWS Network Info</b>
        <div style={{width:"fit-content",minWidth:"450pt"}}>
            { vpcs.map(vpc => <div key={vpc.id}>
                <VpcBox vpc={vpc} />
            </div>)}
        </div>
    </>
}

export default NetworkInfoPage;
