import React from 'react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StandardSpinner } from '../../Spinners';
import { useFetcher, useFetch } from '../../utils/Fetch';
import Char from '../../utils/Char';
import Clipboard from '../../utils/Clipboard';
import Json from '../../utils/Json';
import Yaml from '../../utils/Yaml';

const tdLabelStyle = {
    color: "var(--box-fg)",
    fontWeight: "bold",
    paddingTop: "1pt",
    verticalAlign: "top",
    width: "5%",
    paddingRight: "8pt",
    whiteSpace: "nowrap"
}
const tdContentStyle = {
    verticalAlign: "top",
}

const VpcBox = (props) => {

    const [ showingSubnets, setShowingSubnets ] = useState(false);
    const [ showingSecurityGroups, setShowingSecurityGroups ] = useState(false);

    function toggleSubnets()        { showingSubnets ? setShowingSubnets(false) : setShowingSubnets(true); }
    function toggleSecurityGroups() { showingSecurityGroups ? setShowingSecurityGroups(false) : setShowingSecurityGroups(true); }

    useEffect(() => {
        setShowingSubnets(props.showingAllSubnets);
        setShowingSecurityGroups(props.showingAllSecurityGroups);
    }, [props.showingAllSubnets, props.showingAllSecurityGroups]);

    return <>
        <div className="box margin" style={{marginBottom:"8pt"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>VPC</b>: <b style={{color:"black"}}>{props.vpc?.name}</b>
            </div>
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{props.vpc?.id}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Stack:</td>
                    <td style={tdContentStyle}>{props.vpc?.stack}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>CIDR:</td>
                    <td style={tdContentStyle}>{props.vpc?.cidr}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Status:</td>
                    <td style={tdContentStyle}>{props.vpc?.status}</td>
                </tr>
                <tr onClick={toggleSubnets} className="pointer">
                    <td style={tdLabelStyle}>Subnets:</td>
                    <td>
                        {(showingSubnets) ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u>&nbsp;&nbsp;({props.vpc?.subnets?.length})</small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u>&nbsp;&nbsp;({props.vpc?.subnets?.length})</small>
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
                <tr onClick={toggleSecurityGroups} className="pointer">
                    <td style={tdLabelStyle}>Security Groups:</td>
                    <td>
                        {showingSecurityGroups ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u>&nbsp;&nbsp;({props.vpc?.security_groups?.length})</small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u>&nbsp;&nbsp;({props.vpc?.security_groups?.length})</small>
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
        <div className={"box margin" + (props.subnet?.type === "private" ? " darken" : " lighten")} style={{width:"100%"}}>
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
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{props.subnet?.id}<br /><small>{props.subnet?.subnet_arn}</small></td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Stack:</td>
                    <td style={tdContentStyle}>{props.subnet?.stack}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>CIDR:</td>
                    <td style={tdContentStyle}>{props.subnet?.cidr}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Zone:</td>
                    <td style={tdContentStyle}>{props.subnet?.zone}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>VPC:</td>
                    <td style={tdContentStyle}>{props.subnet?.vpc}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Status:</td>
                    <td style={tdContentStyle}>{props.subnet?.status}</td>
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
        <div className="box margin lighten" style={{width:"100%"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <div style={{float:"right",marginRight:"3pt"}}>
                    <small className="pointer" style={{fontWeight:showingRules ? "bold" : "normal"}} onClick={toggleRules}>
                        All Rules {showingRules ? Char.DownArrowHollow : Char.UpArrowHollow}&nbsp;
                    </small>
                </div>
                <b>Security Group</b>: <b style={{color:"black"}}>{props.security_group?.name}</b>
            </div>
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{props.security_group?.id}<br /><small>{props.security_group?.security_group}</small></td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Stack:</td>
                    <td style={tdContentStyle}>{props.security_group?.stack}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Description:</td>
                    <td style={{whiteSpace:"break-spaces",wordBreak:"break-all"}}>{props.security_group?.description}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>VPC:</td>
                    <td style={tdContentStyle}>{props.security_group?.vpc}</td>
                </tr>
                <tr onClick={toggleInboundRules} className="pointer">
                    <td style={tdLabelStyle}>Inbound Rules:</td>
                    <td>
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
                <tr onClick={toggleOutboundRules} className="pointer">
                    <td style={tdLabelStyle}>Outbound Rules:</td>
                    <td>
                        {(showingOutboundRules) ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
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
        return useFetcher(`/aws/security_group_rules/${props.security_group_id}${args}`, { cache: true });
    }

    function fetchRules(refresh = false) {
        rules.fetch({ nocache: refresh });
    }

    useEffect(() => {
        fetchRules();
    }, [props.direction]);

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
            if ((security_group_rule?.port_from === 22) && (security_group_rule?.port_thru === 22)) {
                return "SSH";
            }
            else if ((security_group_rule?.port_from === 443) && (security_group_rule?.port_thru === 443)) {
                return "HTTPS";
            }
            else if ((security_group_rule?.port_from === 80) && (security_group_rule?.port_thru === 80)) {
                return "HTTP";
            }
        }
        return security_group_rule?.protocol?.toUpperCase();
    }

    function getProtocol(security_group_rule) {
        if ((security_group_rule?.port_from === 3) && (security_group_rule?.port_thru === -1)) {
            return "Destination Unreachable";
        }
        else if ((security_group_rule?.port_from === 4) && (security_group_rule?.port_thru === -1)) {
            return "Source Quench";
        }
        else if ((security_group_rule?.port_from === 8) && (security_group_rule?.port_thru === -1)) {
            return "Echo Request";
        }
        else if ((security_group_rule?.port_from === 11) && (security_group_rule?.port_thru === -1)) {
            return "Time Exceeded";
        }
        return security_group_rule?.protocol?.toUpperCase();
    }

    function getPorts(security_group_rule) {
        if ((security_group_rule?.port_from < 0) && (security_group_rule?.port_thru < 0)) {
            return null;
        }
        else if ((security_group_rule?.port_from === 3) && (security_group_rule?.port_thru === -1)) {
            return null;
        }
        else if ((security_group_rule?.port_from === 4) && (security_group_rule?.port_thru === -1)) {
            return null;
        }
        else if ((security_group_rule?.port_from === 8) && (security_group_rule?.port_thru === -1)) {
            return null;
        }
        else if ((security_group_rule?.port_from === 11) && (security_group_rule?.port_thru === -1)) {
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
        <div className="box" style={{background:"#FEFEFE",width:"100%"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>Security Group Rule</b>: <b style={{color:"black"}}>{props.security_group_rule?.id}</b>
            </div>
            <table width="100%"><tbody>
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
                        <td style={tdContentStyle}>{getPorts(props.security_group_rule)}</td>
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
                    <td style={tdContentStyle}>{props.security_group_rule?.security_group}</td>
                </tr>
            </tbody></table>
        </div>
    </>
}

const Vpcs = (props) => {

    const [ args ] = useSearchParams();
    const [ all ] = useState(args.get("all")?.toLowerCase() === "true")

    const vpcs = useFetchVpcs();

    function useFetchVpcs(refresh = false) {
        return useFetcher(`/aws/network${all ? "/all" : ""}`, { cache: true });
    }

    function fetchVpcs(refresh = false) {
        vpcs.fetch({ nocache: refresh });
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

    return <>
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
        <div style={{width:"100%"}}>
            { vpcs.map(vpc => <div key={vpc.id}>
                <VpcBox vpc={vpc} showingAllSubnets={showingAllSubnets} showingAllSecurityGroups={showingAllSecurityGroups} />
            </div>)}
        </div>
    </>
}

const Subnets = (props) => {

    const [ args ] = useSearchParams();
    const [ all ] = useState(args.get("all")?.toLowerCase() === "true")

    const subnets = useFetchSubnets();

    function useFetchSubnets(refresh = false) {
        return useFetcher(`/aws/subnets${all ? "/all" : ""}`, { cache: true });
    }

    function fetchSubnets(refresh = false) {
        subnets.fetch({ nocache: refresh });
    }

    useEffect(() => {
        fetchSubnets();
    }, []);

    return <>
        <div><b>AWS Subnets</b>&nbsp;&nbsp;({subnets?.length})</div>
        <div style={{width:"fit-content",minWidth:"400pt"}}>
            { subnets.map(subnet => <div key={subnet.id}>
                <SubnetBox subnet={subnet} />
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </>
}

const SecurityGroups = (props) => {

    const [ args ] = useSearchParams();
    const [ all ] = useState(args.get("all")?.toLowerCase() === "true")

    const sgs = useFetchSecurityGroups();

    function useFetchSecurityGroups(refresh = false) {
        return useFetcher(`/aws/security_groups${all ? "/all" : ""}`, { cache: true });
    }

    function fetchSecurityGroups(refresh = false) {
        sgs.fetch({ nocache: refresh });
    }

    useEffect(() => {
        fetchSecurityGroups();
    }, []);

    return <>
        <div>
           <b>AWS Security Groups</b>&nbsp;&nbsp;({sgs?.length})
        </div>
        <div style={{width:"fit-content",minWidth:"400pt"}}>
            { sgs.map(sg => <div key={sg.id}>
                <SecurityGroupBox security_group={sg} />
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </>
}

const InfrastructurePage = () => {

    const [ showingVpcs, setShowingVpcs ] = useState(true);
    const [ showingSubnets, setShowingSubnets ] = useState(false);
    const [ showingSecurityGroups, setShowingSecurityGroups ] = useState(false);
    const [ showingGac, setShowingGac ] = useState(false);
    const [ showingEcosystem, setShowingEcosystem ] = useState(false);
    const [ stacks, setStacks ] = useState([]);

    function toggleVpcs()           { setShowingVpcs(value => !value); }
    function toggleSubnets()        { setShowingSubnets(value => !value); }
    function toggleSecurityGroups() { setShowingSecurityGroups(value => !value); }
    function toggleGac()                 { setShowingGac(value => !value); }
    function toggleEcosystem()           { setShowingEcosystem(value => !value); }

    function showingStack(stackName = null) {
        return stackName ? stacks.indexOf(stackName) >= 0 : stacks.length > 0;
    }
    function toggleStack(stackName) {
        if (showingStack(stackName)) {
            const i = stacks.indexOf(stackName);
            if (i >= 0) { stacks.splice(i, 1); setStacks([...stacks]); }
        }
        else {
            setStacks([stackName, ...stacks]);
        }
    }

    return <table><tbody><tr>
        <td style={{verticalAlign:"top", paddingRight:"8pt"}}>

            <div><b>AWS Network</b></div>
            <div className="box margin" style={{width:"100%",marginBottom:"6pt"}}>
                <div className="pointer" style={{fontWeight:showingVpcs ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleVpcs}>VPCs</div>
                <div className="pointer" style={{fontWeight:showingSubnets ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleSubnets}>Subnets</div>
                <div className="pointer" style={{fontWeight:showingSecurityGroups ? "bold" : "normal"}} onClick={toggleSecurityGroups}>Security Groups</div>
            </div>

            <div className="box margin thickborder" style={{width:"100%",marginBottom:"6pt"}}>
                <div className="pointer" style={{fontWeight:showingGac ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleGac}>Global Application Configuration</div>
                <div className="pointer" style={{fontWeight:showingEcosystem ? "bold" : "normal"}} onClick={toggleEcosystem}>Ecosystem Definition</div>
            </div>

            <StackList toggleStack={toggleStack} showingStack={showingStack} />
        </td>
        {(showingVpcs || showingStack() || showingGac || showingEcosystem) &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                { showingVpcs && <Vpcs /> }
                <StackBoxes stacks={stacks} hideStack={toggleStack} />
                { showingEcosystem && <EcosystemBox /> }
                { showingGac && <GacBox /> }
            </td>
        }
        {(showingSubnets) &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                <Subnets />
            </td>
        }
        {(showingSecurityGroups) &&
            <td style={{verticalAlign:"top"}}>
                <SecurityGroups />
            </td>
        }
    </tr></tbody></table>
}

const StackList = (props) => {
    const stacks = useFetcher("/aws/stacks");
    useEffect(() => {
        stacks.fetch();
    }, []);
    const styleLast = { cursor: "pointer" };
    const styleNotLast = { ...styleLast, borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt" };
    return <>
        <div><b>AWS Stacks</b></div>
        <div className="box" style={{whiteSpace:"nowrap"}}>
            {stacks.map((stack, i) => {
                function toggleStack() { props.toggleStack(stack.name); }
                const style = {...(i + 1 < stacks.length ? styleNotLast : styleLast), ...(props.showingStack(stack.name) ? {fontWeight:"bold"} : {})};
                return <div key={stack.name} style={style} onClick={toggleStack}>{stack.name}</div>
            })}
        </div>
    </>
}

const StackBoxes = (props) => {
    return <>
        { props.stacks.map(stackName =>
            <StackBox key={stackName} stackName={stackName} hideStack={props.hideStack} />
        )}
    </>
}

const StackBox = (props) => {
    const stack = useFetcher(`/aws/stacks/${props.stackName}`);
    const [ showingOutputs, setShowingOutputs ] = useState(false);
    const toggleOutputs = () => setShowingOutputs(!showingOutputs);
    const [ showingParameters, setShowingParameters ] = useState(false);
    const toggleParameters = () => setShowingParameters(!showingParameters);
    const [ showingResources, setShowingResources ] = useState(false);
    const toggleResources = () => setShowingResources(!showingResources);
    const hideStack = () => props.hideStack(stack.data?.name);
    useEffect(() => {
        stack.fetch();
    }, []);
    return <div style={{maxWidth:"500pt",marginBottom:"8pt"}}>
        <div><b>AWS Stack: {props.stackName}</b><div style={{float:"right",cursor:"pointer"}} onClick={() => stack.refresh()}>{Char.Refresh}</div></div>
        <div className="box margin">
            { stack.loading ?
                <StandardSpinner label="Loading stack info" />
            : 
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>Name:</td>
                    <td style={{...tdContentStyle,wordBreak:"break-all"}}>
                        <b style={{float:"right",cursor:"pointer",marginTop:"-2pt"}} onClick={hideStack}>{Char.X}</b>
                        {stack.data?.name}
                    </td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={{...tdContentStyle,wordBreak:"break-all"}}>
                        <small>{stack.data?.id}</small>
                    </td>
                </tr>
                { stack.data?.role_arn &&
                    <tr>
                        <td style={tdLabelStyle}>Role:</td>
                        <td style={tdContentStyle}>{stack.data?.role_arn || Char.EmptySet}</td>
                    </tr>
                }
                <tr>
                    <td style={tdLabelStyle}>Description:</td>
                    <td style={tdContentStyle}>{stack.data?.description}</td>
                </tr>
                <tr><td style={{height:"2pt"}} colSpan="2"></td></tr>
                <tr><td style={{height:"1px",background:"var(--box-fg)"}} colSpan="2"></td></tr>
                <tr><td style={{height:"2pt"}} colSpan="2"></td></tr>
                <tr>
                    <td style={tdLabelStyle}>Status:</td>
                    <td style={tdContentStyle}>{stack.data?.status}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Created:</td>
                    <td style={tdContentStyle}>{stack.data?.created}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Updated:</td>
                    <td style={tdContentStyle}>{stack.data?.updated}</td>
                </tr>
                <tr><td style={{height:"2pt"}} colSpan="2"></td></tr>
                <tr><td style={{height:"1px",background:"var(--box-fg)"}} colSpan="2"></td></tr>
                <tr><td style={{height:"2pt"}} colSpan="2"></td></tr>
                <tr className="pointer" onClick={toggleOutputs}>
                    <td style={tdLabelStyle}>Outputs:</td>
                    <td style={tdContentStyle}>
                        { showingOutputs ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                { showingOutputs && <>
                    <tr>
                        <td colSpan="2" style={{paddingTop:"2pt"}}>
                            <StackOutputs stackName={stack.data?.name} />
                        </td>
                    </tr>
                </>}
                <tr className="pointer" onClick={toggleParameters}>
                    <td style={tdLabelStyle}>Parameters:</td>
                    <td style={tdContentStyle}>
                        { showingParameters ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                { showingParameters && <>
                    <tr>
                        <td colSpan="2" style={{paddingTop:"2pt"}}>
                            <StackParameters stackName={stack.data?.name} />
                        </td>
                    </tr>
                </>}
                <tr className="pointer" onClick={toggleResources}>
                    <td style={tdLabelStyle}>Resources:</td>
                    <td style={tdContentStyle}>
                        { showingResources ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                { showingResources && <>
                    <tr>
                        <td colSpan="2" style={{paddingTop:"2pt"}}>
                            <StackResources stackName={stack.data?.name} />
                        </td>
                    </tr>
                </>}
            </tbody></table>
            }
        </div>
    </div>
}

const StackOutputs = (props) => {
    const outputs = useFetch(`/aws/stacks/${props.stackName}/outputs`, { cache: true });
    return <div style={{maxWidth:"480pt"}}>
        <div className="box lighten">
            { outputs.empty ? <>
                { outputs.loading ? <>
                    <StandardSpinner label="Loading stack outputs" />
                </>:<>
                    <li><i>No stack outputs.</i></li>
                </>}
            </>:<>
                <ul style={{marginBottom:"1pt"}}>
                    { outputs.data && Object.keys(outputs.data)?.map(output => <li key={output}>
                        <b>{output}</b> <br />
                        <div style={{wordBreak:"break-all"}}>
                            { outputs.data[output] === "********" ? <>
                                <span style={{color:"red"}}>REDACTED</span>
                            </>:<>
                                {outputs.data[output]}
                            </>}
                        </div>
                    </li>)}
                </ul>
            </>}
        </div>
    </div>
}

const StackParameters = (props) => {
    const parameters = useFetch(`/aws/stacks/${props.stackName}/parameters`, { cache: true });
    return <div style={{maxWidth:"480pt"}}>
        <div className="box lighten">
            { parameters.empty ? <>
                { parameters.loading ? <>
                    <StandardSpinner label="Loading stack parameters" />
                </>:<>
                    <li><i>No stack parameters.</i></li>
                </>}
            </>:<>
                <ul style={{marginBottom:"1pt"}}>
                    { parameters.data && Object.keys(parameters.data)?.map(parameter => <li key={parameter}>
                        <b>{parameter}</b> <br />
                        <div style={{wordBreak:"break-all"}}>
                            { parameters.data[parameter] === "********" ? <>
                                <i style={{color:"red"}}>REDACTED</i>
                            </>:<>
                                {parameters.data[parameter]}
                            </>}
                        </div>
                    </li>)}
                </ul>
            </>}
        </div>
    </div>
}

const StackResources = (props) => {
    const resources = useFetch(`/aws/stacks/${props.stackName}/resources`, { cache: true });
    return <div style={{maxWidth:"480pt"}}>
        <div className="box lighten">
            { resources.empty ? <>
                { resources.loading ? <>
                    <StandardSpinner label="Loading stack resources" />
                </>:<>
                    <li><i>No stack resources.</i></li>
                </>}
            </>:<>
                <ul style={{marginBottom:"1pt"}}>
                    { resources.data && Object.keys(resources.data)?.map(resource => <li key={resource}>
                        <b style={{wordBreak:"break-all"}}>{resource}</b> <br />
                        <div style={{wordBreak:"break-all"}}>
                            { resources.data[resource] === "********" ? <>
                                <span style={{color:"red"}}>REDACTED</span>
                            </>:<>
                                {resources.data[resource]}
                            </>}
                        </div>
                    </li>)}
                </ul>
            </>}
        </div>
    </div>
}

const GacBox = (props) => {
    const info = useFetch("/info", { cache: true });
    return <div style={{maxWidth:"500pt",marginBottom:"8pt"}}>
        <div><b>GAC</b>:&nbsp;<b>{info.data?.gac?.name}</b>&nbsp;
            <a className="fa fa-external-link"
                style={{float:"right",fontWeight:"bold",marginRight:"2pt",marginTop:"3pt",color:"var(--box-fg)"}}
                href={`https://us-east-1.console.aws.amazon.com/secretsmanager/secret?name=${info.data?.gac?.name}&region=us-east-1`}
                rel="noreferrer" target="_blank" />
        </div>
        <div className="box margin">
            <ul style={{marginBottom:"1pt"}}>
                { info.data?.gac && Object.keys(info.data.gac.values)?.map(name => <li key={name}>
                    <b>{name}</b> <br />
                    { info.data.gac.values[name] === "********" ? <i style={{color:"red"}}>REDACTED</i> : info.data.gac.values[name] }
                </li>)}
            </ul>
        </div>
    </div>
}

const EcosystemBox = (props) => {
    const info = useFetch("/info", { cache: true });
    return <div style={{maxWidth:"500pt",marginBottom:"8pt"}}>
        <div><b>Ecosystem</b>:&nbsp;<b>{info.data?.buckets?.env}</b></div>
        <pre className="box margin">
            {Yaml.Format(info.data?.buckets?.ecosystem)}
        </pre>
    </div>
}

export default InfrastructurePage;
