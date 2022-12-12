import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
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
    color: "var(--box-fg)",
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

    useEffect(() => {
        setShowingSubnets(props.showingAllSubnets);
        setShowingSecurityGroups(props.showingAllSecurityGroups);
    }, [props.showingAllSubnets, props.showingAllSecurityGroups]);

    return <>
        <div className="box margin" style={{}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>VPC</b>: <b style={{color:"black"}}>{props.vpc?.name}</b>
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
                    <td>{props.vpc?.status}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle} onClick={toggleSubnets} className="pointer">Subnets:</td>
                    <td onClick={toggleSubnets} className="pointer">
                        {(showingSubnets) ? <>
                            <small><u>Hide</u>&nbsp;{Char.DownArrowHollow}&nbsp;&nbsp;({props.vpc?.subnets?.length})</small>
                        </>:<>
                            <small><u>Show</u>&nbsp;{Char.UpArrowHollow}&nbsp;&nbsp;({props.vpc?.subnets?.length})</small>
                        </>}
                    </td>
                </tr>
                {(showingSubnets) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            {props.vpc?.subnets.map((subnet, i) => <div key={subnet.id}>
                                <SubnetBox subnet={subnet} />
                                <div style={{height:"3pt"}} />
                            </div>)}
                        </td>
                    </tr>
                </>}
                <tr>
                    <td style={tdLabelStyle} onClick={toggleSecurityGroups} className="pointer">Security Groups:</td>
                    <td onClick={toggleSecurityGroups} className="pointer">
                        {showingSecurityGroups ? <>
                            <small><u>Hide</u>&nbsp;{Char.DownArrowHollow}&nbsp;&nbsp;({props.vpc?.security_groups?.length})</small>
                        </>:<>
                            <small><u>Show</u>&nbsp;{Char.UpArrowHollow}&nbsp;&nbsp;({props.vpc?.security_groups?.length})</small>
                        </>}
                    </td>
                </tr>
                {showingSecurityGroups && <>
                    <tr>
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
        <div className={"box margin" + (props.subnet?.type === "private" ? " darken" : " lighten")} style={{width:"100%",fontSize:"small"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>Subnet</b>: <b style={{color:"black"}}>{props.subnet?.name}</b>
                <small style={{float:"right"}}>
                    {props.subnet?.type === "private" ? <>
                        <b style={{color:"red"}}>PRIVATE</b>
                    </>:<>
                        <b style={{color:"green"}}>PUBLIC</b>
                    </>}
                 </small>
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
                    <td>{props.subnet?.status}</td>
                </tr>
            </tbody></table>
        </div>
    </>
}

const SecurityGroupBox = (props) => {

    const [ showingRules, setShowingRules ] = useState(false);
    const [ showingInboundRules, setShowingInboundRules ] = useState(false);
    const [ showingOutboundRules, setShowingOutboundRules ] = useState(false);

    function toggleRules() {
        if (showingRules) {
            setShowingRules(false);
            setShowingInboundRules(false);
            setShowingOutboundRules(false);
        }
        else {
            setShowingRules(true);
            setShowingInboundRules(true);
            setShowingOutboundRules(true);
        }
    }
    function toggleInboundRules() { showingInboundRules ? setShowingInboundRules(false) : setShowingInboundRules(true); }
    function toggleOutboundRules() { showingOutboundRules ? setShowingOutboundRules(false) : setShowingOutboundRules(true); }

    useEffect(() => {
        setShowingRules(props.showingAllRules);
    }, [props.showingAllRules]);

    return <>
        <div className="box margin lighten" style={{width:"100%",fontSize:"small"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <div style={{float:"right",marginRight:"3pt"}}>
                    <small className="pointer" style={{fontWeight:showingRules ? "bold" : "normal"}} onClick={toggleRules}>
                        All Rules {showingRules ? Char.DownArrowHollow : Char.UpArrowHollow}&nbsp;
                    </small>
                </div>
                <b>Security Group</b>: <b style={{color:"black"}}>{props.security_group?.name}</b>
            </div>
            <table width="100%" style={{fontSize:"small"}}><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{props.security_group?.id}<br /><small>{props.security_group?.security_group}</small></td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Description:</td>
                    <td style={{whiteSpace:"break-spaces",wordBreak:"break-all"}}>{props.security_group?.description}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>VPC:</td>
                    <td>{props.security_group?.vpc}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle} onClick={toggleInboundRules} className="pointer">Inbound Rules:</td>
                    <td onClick={toggleInboundRules} className="pointer">
                        {(showingInboundRules) ? <>
                            <small><u>Hide</u>&nbsp;{Char.DownArrowHollow}</small>
                        </>:<>
                            <small><u>Show</u>&nbsp;{Char.UpArrowHollow}</small>
                        </>}
                    </td>
                </tr>
                {(showingInboundRules) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <SecurityGroupRulesBox security_group_id={props.security_group?.id} direction="inbound" />
                        </td>
                    </tr>
                </>}
                <tr>
                    <td style={tdLabelStyle} onClick={toggleOutboundRules} className="pointer">Outbound Rules:</td>
                    <td onClick={toggleOutboundRules} className="pointer">
                        {(showingOutboundRules) ? <>
                            <small><u>Hide</u>&nbsp;{Char.DownArrowHollow}</small>
                        </>:<>
                            <small><u>Show</u>&nbsp;{Char.UpArrowHollow}</small>
                        </>}
                    </td>
                </tr>
                {(showingOutboundRules) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <SecurityGroupRulesBox security_group_id={props.security_group?.id} direction="outbound" />
                        </td>
                    </tr>
                </>}
            </tbody></table>
        </div>
    </>
}

const SecurityGroupRulesBox = (props) => {

    const rules = useFetchRules();

    function useFetchRules(refresh = false) {
        const args = props.direction === "inbound" ? "?direction=inbound" : (props.direction === "outbound" ? "?direction=outbound" : "");
        return useFetch({ url: Server.Url(`/aws/security_group_rules/${props.security_group_id}${args}`), nofetch: true, cache: true });
    }

    function fetchRules(refresh = false) {
        rules.fetch({ nocache: refresh });
    }

    function refreshRules() {
        fetchRules(true);
    }

    useEffect(() => {
        fetchRules();
    }, []);

    return <>
        {rules?.map((rule, i) => <div key={rule.id}>
            <SecurityGroupRuleBox security_group_rule={rule} />
            <div style={{height:"4pt"}} />
        </div>)}
    </>
}

const SecurityGroupRuleBox = (props) => {

    function getType(security_group_rule) {
        if (security_group_rule?.protocol?.toUpperCase() === "TCP") {
            if ((security_group_rule?.port_from == 22) && (security_group_rule?.port_thru == 22)) {
                return "SSH";
            }
            else if ((security_group_rule?.port_from == 443) && (security_group_rule?.port_thru == 443)) {
                return "HTTPS";
            }
            else if ((security_group_rule?.port_from == 80) && (security_group_rule?.port_thru == 80)) {
                return "HTTP";
            }
        }
        return security_group_rule?.protocol?.toUpperCase();
    }

    function getProtocol(security_group_rule) {
        if ((security_group_rule?.port_from == 3) && (security_group_rule?.port_thru == -1)) {
            return "Destination Unreachable";
        }
        else if ((security_group_rule?.port_from == 4) && (security_group_rule?.port_thru == -1)) {
            return "Source Quench";
        }
        else if ((security_group_rule?.port_from == 8) && (security_group_rule?.port_thru == -1)) {
            return "Echo Request";
        }
        else if ((security_group_rule?.port_from == 11) && (security_group_rule?.port_thru == -1)) {
            return "Time Exceeded";
        }
        return security_group_rule?.protocol?.toUpperCase();
    }

    function getPorts(security_group_rule) {
        if ((security_group_rule?.port_from < 0) && (security_group_rule?.port_thru < 0)) {
            return null;
        }
        else if ((security_group_rule?.port_from == 3) && (security_group_rule?.port_thru == -1)) {
            return null;
        }
        else if ((security_group_rule?.port_from == 4) && (security_group_rule?.port_thru == -1)) {
            return null;
        }
        else if ((security_group_rule?.port_from == 8) && (security_group_rule?.port_thru == -1)) {
            return null;
        }
        else if ((security_group_rule?.port_from == 11) && (security_group_rule?.port_thru == -1)) {
            return null;
        }
        else {
            if (props.security_group_rule?.port_from === props.security_group_rule?.port_thru) {
                return props.security_group_rule?.port_from
            }
            else {
                return `${props.security_group_rule?.port_from} - ${props.security_group_rule?.port_thru}`;
            }
        }
    }

    return <>
        <div className="box" style={{background:"#FEFEFE",width:"100%",fontSize:"small"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>Security Group Rule</b>: <b style={{color:"black"}}>{props.security_group_rule?.id}</b>
            </div>
            <table width="100%" style={{fontSize:"small"}}><tbody>
                <tr>
                    <td style={tdLabelStyle}>Direction:</td>
                    <td style={tdContentStyle}>{props.security_group_rule?.egress ? "Outbound" : "Inbound"}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Protocol:</td>
                    <td style={tdContentStyle}>{getProtocol(props.security_group_rule)}</td>
                </tr>
                {(getType(props.security_group_rule) !== getProtocol(props.security_group_rule)) &&
                    <tr>
                        <td style={tdLabelStyle}>Type:</td>
                        <td style={tdContentStyle}>{getType(props.security_group_rule)}</td>
                    </tr>
                }
                {(getPorts(props.security_group_rule)) &&
                    <tr>
                        <td style={tdLabelStyle}>Port:</td>
                        <td>{getPorts(props.security_group_rule)}</td>
                    </tr>
                }
                {props.security_group_rule?.cidr &&
                    <tr>
                        <td style={tdLabelStyle}>CIDR:</td>
                        <td style={tdContentStyle}>{props.security_group_rule?.cidr}</td>
                    </tr>
                }
                {props.security_group_rule?.description &&
                    <tr>
                        <td style={tdLabelStyle}>Description:</td>
                        <td style={{whiteSpace:"break-spaces",wordBreak:"break-all"}}>{props.security_group_rule?.description}</td>
                    </tr>
                }
                <tr>
                    <td style={tdLabelStyle}>Security Group:</td>
                    <td>{props.security_group_rule?.security_group}</td>
                </tr>
            </tbody></table>
        </div>
    </>
}

const VpcsPanel = (props) => {

    const [ args, setArgs ] = useSearchParams();
    const [ all, setAll ] = useState(args.get("all")?.toLowerCase() === "true")

    const vpcs = useFetchVpcs();

    function useFetchVpcs(refresh = false) {
        return useFetch({ url: Server.Url(`/aws/network${all ? "/all" : ""}`), nofetch: true, cache: true });
    }

    function fetchVpcs(refresh = false) {
        vpcs.fetch({ nocache: refresh });
    }

    function refreshVpcs() {
        fetchVpcs(true);
    }

    const [ showingAllSubnets, setShowingAllSubnets ] = useState(false);
    const [ showingAllSecurityGroups, setShowingAllSecurityGroups ] = useState(false);

    useEffect(() => {
        fetchVpcs();
    }, [showingAllSubnets]);

    function toggleShowAllSubnets() {
        setShowingAllSubnets(value => { return !value });
    }
    function toggleShowAllSecurityGroups() {
        setShowingAllSecurityGroups(value => { return !value });
    }

    return <table style={{maxWidth:"500pt"}}><tbody><tr><td>
        <div>
           <div style={{float:"right",marginRight:"3pt"}}>
                <small className="pointer" style={{fontWeight:showingAllSubnets ? "bold" : "normal"}} onClick={toggleShowAllSubnets}>
                    Subnets {showingAllSubnets ? Char.DownArrowHollow : Char.UpArrowHollow}&nbsp;
                </small>
                &nbsp;|&nbsp;
                <small className="pointer" style={{fontWeight:showingAllSecurityGroups ? "bold" : "normal"}} onClick={toggleShowAllSecurityGroups}>
                    Security {showingAllSecurityGroups ? Char.DownArrowHollow : Char.UpArrowHollow}&nbsp;
                </small>
           </div>
           <b>AWS VPCs</b>&nbsp;&nbsp;({vpcs?.length})
        </div>
        <div style={{width:"fit-content",minWidth:"450pt"}}>
            { vpcs.map(vpc => <div key={vpc.id}>
                <VpcBox vpc={vpc} showingAllSubnets={showingAllSubnets} showingAllSecurityGroups={showingAllSecurityGroups} />
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </td></tr></tbody></table>
}

const SubnetsPanel = (props) => {

    const [ args, setArgs ] = useSearchParams();
    const [ all, setAll ] = useState(args.get("all")?.toLowerCase() === "true")

    const subnets = useFetchSubnets();

    function useFetchSubnets(refresh = false) {
        return useFetch({ url: Server.Url(`/aws/subnets${all ? "/all" : ""}`), nofetch: true, cache: true });
    }

    function fetchSubnets(refresh = false) {
        subnets.fetch({ nocache: refresh });
    }

    function refreshSubnets() {
        fetchSubnets(true);
    }

    useEffect(() => {
        fetchSubnets();
    }, []);

    return <table style={{maxWidth:"500pt"}}><tbody><tr><td>
        <div>
           <b>AWS Subnets</b>&nbsp;&nbsp;({subnets?.length})
        </div>
        <div style={{width:"fit-content",minWidth:"400pt"}}>
            { subnets.map(subnet => <div key={subnet.id}>
                <SubnetBox subnet={subnet} />
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </td></tr></tbody></table>
}

const SecurityGroupsPanel = (props) => {

    const [ args, setArgs ] = useSearchParams();
    const [ all, setAll ] = useState(args.get("all")?.toLowerCase() === "true")

    const sgs = useFetchSecurityGroups();

    function useFetchSecurityGroups(refresh = false) {
        return useFetch({ url: Server.Url(`/aws/security_groups${all ? "/all" : ""}`), nofetch: true, cache: true });
    }

    function fetchSecurityGroups(refresh = false) {
        sgs.fetch({ nocache: refresh });
    }

    function refreshSecurityGroups() {
        fetchSecurityGroups(true);
    }

    useEffect(() => {
        fetchSecurityGroups();
    }, []);

    return <table style={{maxWidth:"500pt"}}><tbody><tr><td>
        <div>
           <b>AWS Security Groups</b>&nbsp;&nbsp;({sgs?.length})
        </div>
        <div style={{width:"fit-content",minWidth:"400pt"}}>
            { sgs.map(sg => <div key={sg.id}>
                <SecurityGroupBox security_group={sg} />
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </td></tr></tbody></table>
}

const NetworkInfoPage = () => {

    const [ showingVpcsPanel, setShowingVpcsPanel ] = useState(true);
    const [ showingSubnetsPanel, setShowingSubnetsPanel ] = useState(false);
    const [ showingSecurityGroupsPanel, setShowingSecurityGroupsPanel ] = useState(false);

    function toggleVpcsPanel()           { setShowingVpcsPanel(value => !value); }
    function toggleSubnetsPanel()        { setShowingSubnetsPanel(value => !value); }
    function toggleSecurityGroupsPanel() { setShowingSecurityGroupsPanel(value => !value); }

    return  <table><tbody><tr>
        <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
            <div>
                <b>AWS Network</b>
            </div>
            <div className="box margin" style={{width:"120pt"}}>
                <div className="pointer" style={{fontWeight:showingVpcsPanel ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleVpcsPanel}>VPCs</div>
                <div className="pointer" style={{fontWeight:showingSubnetsPanel ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleSubnetsPanel}>Subnets</div>
                <div className="pointer" style={{fontWeight:showingSecurityGroupsPanel ? "bold" : "normal"}} onClick={toggleSecurityGroupsPanel}>Security Groups</div>
            </div>
        </td>
        {(showingVpcsPanel) &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                <VpcsPanel />
            </td>
        }
        {(showingSubnetsPanel) &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                <SubnetsPanel />
            </td>
        }
        {(showingSecurityGroupsPanel) &&
            <td style={{verticalAlign:"top"}}>
                <SecurityGroupsPanel />
            </td>
        }
    </tr></tbody></table>
}

export default NetworkInfoPage;
