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

const tdLabelStyle = {
    fontWeight: "bold",
    fontSize: "small",
    paddingTop: "1pt",
    verticalAlign: "top",
    width: "5%",
    paddingRight: "8pt",
    whiteSpace: "nowrap"
}
const tdContentStyle = {
    verticalAlign: "top"
}


const VpcBox = (props) => {

    const [ showingSubnets, setShowingSubnets ] = useState(false);
    const [ showingSecurityGroups, setShowingSecurityGroups ] = useState(false);

    function showSubnets()          { setShowingSubnets(true); }
    function hideSubnets()          { setShowingSubnets(false); }
    function toggleSubnets()        { showingSubnets ? setShowingSubnets(false) : setShowingSubnets(true); }
    function showSecurityGroups()   { setShowingSecurityGroups(true); }
    function hideSecurityGroups()   { setShowingSecurityGroups(false); }
    function toggleSecurityGroups() { showingSecurityGroups ? setShowingSecurityGroups(false) : setShowingSecurityGroups(true); }

    return <>
        <div className="box margin" style={{}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>VPC</b>: <b>{props.vpc?.name}</b>
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
                    <td style={tdLabelStyle}>Subnets:</td>
                    <td>
                        {showingSubnets ? <>
                            <small><u>Hide</u>&nbsp;{Char.DownArrowHollow}&nbsp;&nbsp;({props.vpc?.subnets?.length})</small>
                        </>:<>
                            <small><u>Show</u>&nbsp;{Char.UpArrowHollow}&nbsp;&nbsp;({props.vpc?.subnets?.length})</small>
                        </>}
                    </td>
                </tr>
                {showingSubnets && <>
                    <tr onClick={toggleSubnets} className="pointer">
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            {props.vpc?.subnets.map((subnet, i) => <div key={subnet.id}>
                                <SubnetBox subnet={subnet} />
                                <div style={{height:"3pt"}} />
                            </div>)}
                        </td>
                    </tr>
                </>}
                <tr onClick={toggleSecurityGroups} className="pointer">
                    <td style={tdLabelStyle}>Security Groups:</td>
                    <td>
                        {showingSecurityGroups ? <>
                            <small><u>Hide</u>&nbsp;{Char.DownArrowHollow}&nbsp;&nbsp;({props.vpc?.security_groups?.length})</small>
                        </>:<>
                            <small><u>Show</u>&nbsp;{Char.UpArrowHollow}&nbsp;&nbsp;({props.vpc?.security_groups?.length})</small>
                        </>}
                    </td>
                </tr>
                {showingSecurityGroups && <>
                    <tr onClick={toggleSecurityGroups} className="pointer">
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            {props.vpc?.security_groups.map((security_group, i) => <div key={security_group.id}>
                                <SecurityGroupBox security_group={security_group} />
                                { i < props.vpc?.security_groups?.length - 1 && <> <div style={{height:"3pt"}}/> </>}
                            </div>)}
                        </td>
                    </tr>
                </>}
            </tbody></table>
        </div>
    </>
}

const SubnetBox = (props) => {
    return <>
        <div className="box margin lighten" style={{width:"100%",fontSize:"small"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>Subnet</b>: <b>{props.subnet?.name}</b>
            </div>
            <table width="100%" style={{fontSize:"small"}}><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{props.subnet?.id}<br /><small>{props.subnet?.subnet_arn}</small></td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>CIDR:</td>
                    <td>{props.subnet?.cidr}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Availability Zone:</td>
                    <td>{props.subnet?.zone}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>VPC:</td>
                    <td>{props.subnet?.vpc}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Status:</td>
                    <td>{props.subnet?.state}</td>
                </tr>
            </tbody></table>
        </div>
    </>
}

const SecurityGroupBox = (props) => {
    return <>
        <div className="box margin lighten" style={{width:"100%",fontSize:"small"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>Security Group</b>: <b>{props.security_group?.name}</b>
            </div>
            <table width="100%" style={{fontSize:"small"}}><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{props.security_group?.id}<br /><small>{props.security_group?.security_group}</small></td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Description:</td>
                    <td>{props.security_group?.description}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>VPC:</td>
                    <td>{props.security_group?.vpc}</td>
                </tr>
            </tbody></table>
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
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </>
}

export default NetworkInfoPage;
