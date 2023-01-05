import React from 'react';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StandardSpinner } from '../../Spinners';
import { useFetch } from '../../utils/Fetch';
import { ExternalLink } from '../../Components';
import Char from '../../utils/Char';
import Clipboard from '../../utils/Clipboard';
import Json from '../../utils/Json';
import Type from '../../utils/Type';
import Yaml from '../../utils/Yaml';
import Uuid from 'react-uuid';
import { useComponentDefinitions, useSelectedComponents } from '../../Hooks.js';
import useKeyedState from '../../hooks/KeyedState';

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

const InfrastructurePage = () => {

    //const keyedState = useKeyedState();
    const keyedState = useKeyedState();

    const componentDefinitions = useComponentDefinitions([
         { type: "stack",           create: createStack          },
         { type: "vpcs",            create: createVpcs           },
         { type: "subnets-public",  create: createSubnetsPublic  },
         { type: "subnets-private", create: createSubnetsPrivate },
         { type: "security-groups", create: createSecurityGroups },
         { type: "gac",             create: createGac            },
         { type: "ecosystem",       create: createEcosystem      }
    ]);

    const componentsLeft = useSelectedComponents(componentDefinitions);
    const componentsRight = useSelectedComponents(componentDefinitions);

    function createVpcs(name, key, unselect, args) {
        const { keyedState } = args;
        return <Vpcs keyedState={keyedState.keyed(key)} hide={unselect} />;
    }

    function createSubnetsPrivate(name, key, unselect, args) {
        const { keyedState } = args;
        return <Subnets type="private" keyedState={keyedState.keyed(key)} hide={unselect} />;
    }

    function createSubnetsPublic(name, key, unselect, args) {
        const { keyedState } = args;
        return <Subnets type="public" keyedState={keyedState.keyed(key)} hide={unselect} />;
            
    }

    function createSecurityGroups(name, key, unselect, args) {
        const { keyedState } = args;
        return <SecurityGroups keyedState={keyedState.keyed(key)} hide={unselect} />;
    }

    function createGac(name, key, unselect, args) {
        return <Gac hide={unselect} />;
    }

    function createEcosystem(name, key, unselect, args) {
        return <Ecosystem hide={unselect} />;
    }

    function createStack(name, key, unselect, args) {
        const { keyedState } = args;
        return <Stack stackName={name} keyedState={keyedState.keyed(key)} hide={unselect} />;
    }

    const BoxWrapper = ({ title, close, children }) => {
        return <div style={{marginBottom:"8pt"}}>
            <div>
                <b>{title}</b>
                { close && <small onClick={close} className="pointer" style={{float:"right",marginRight:"6pt"}}><b>{Char.X}</b></small> }
            </div>
            {children}
       </div>
    }

    const selectedVpcs           = () => componentsLeft.selected("vpcs");
    const toggleVpcs             = () => componentsLeft.toggle("vpcs");

    const selectedGac            = () => componentsLeft.selected("gac");
    const toggleGac              = () => componentsLeft.toggle("gac");

    const selectedEcosystem      = () => componentsLeft.selected("ecosystem");
    const toggleEcosystem        = () => componentsLeft.toggle("ecosystem");

    const selectedStack = (stackName) => componentsLeft.selected("stack", stackName);
    const toggleStack   = (stackName) => componentsLeft.toggle("stack", stackName);

    const selectedSubnetsPublic  = () => componentsRight.selected("subnets-public");
    const toggleSubnetsPublic    = () => componentsRight.toggle("subnets-public");

    const selectedSubnetsPrivate = () => componentsRight.selected("subnets-private");
    const toggleSubnetsPrivate   = () => componentsRight.toggle("subnets-private");

    const selectedSecurityGroups = () => componentsRight.selected("security-groups");
    const toggleSecurityGroups   = () => componentsRight.toggle("security-groups");

    useEffect(() => {
        toggleEcosystem();
        toggleVpcs();
    }, []);

    return <table><tbody><tr>
        <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
            <NetworkList
                keyedState={keyedState}
                showVpcs={selectedVpcs} toggleVpcs={toggleVpcs}
                showSubnetsPublic={selectedSubnetsPublic} toggleSubnetsPublic={toggleSubnetsPublic}
                showSubnetsPrivate={selectedSubnetsPrivate} toggleSubnetsPrivate={toggleSubnetsPrivate}
                showSecurityGroups={selectedSecurityGroups} toggleSecurityGroups={toggleSecurityGroups}
            />
            <ConfigList
                showGac={selectedGac} toggleGac={toggleGac}
                showEcosystem={selectedEcosystem} toggleEcosystem={toggleEcosystem} />
            <StackList
                toggleStack={toggleStack}
                selectedStack={selectedStack}
            />
        </td>
        { !componentsLeft.empty() &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                { componentsLeft.map((component, i) => <div key={component.key}>{component.ui({ keyedState: keyedState })}</div>) }
            </td>
        }
        { !componentsRight.empty() &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                { componentsRight.map(component => <div key={component.key}>{component.ui({ keyedState: keyedState })}</div>) }
            </td>
        }
    </tr></tbody></table>
}

const NetworkList = (props) => {
    const { showVpcs, toggleVpcs, showSecurityGroups, toggleSecurityGroups } = props;
    const { showSubnetsPublic, toggleSubnetsPublic, showSubnetsPrivate, toggleSubnetsPrivate } = props;
    return <>
        <div><b>AWS Network</b></div>
        <div className="box margin" style={{width:"100%",marginBottom:"6pt"}}>
            <div className="pointer" style={{fontWeight:showVpcs() ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleVpcs}>VPCs</div>
            <div className="pointer" style={{fontWeight:showSubnetsPublic() ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleSubnetsPublic}>Public Subnets</div>
            <div className="pointer" style={{fontWeight:showSubnetsPrivate() ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleSubnetsPrivate}>Private Subnets</div>
            <div className="pointer" style={{fontWeight:showSecurityGroups() ? "bold" : "normal"}} onClick={toggleSecurityGroups}>Security Groups</div>
        </div>
    </>
}

const ConfigList = (props) => {
    const { showGac, toggleGac, showEcosystem, toggleEcosystem } = props;
    return <>
        <div className="box margin thickborder" style={{width:"100%",marginBottom:"6pt"}}>
            <div className="pointer" style={{fontWeight:showGac() ? "bold" : "normal",borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt"}} onClick={toggleGac}>Global Application Configuration</div>
            <div className="pointer" style={{fontWeight:showEcosystem() ? "bold" : "normal"}} onClick={toggleEcosystem}>Ecosystem Definition</div>
        </div>
    </>
}

const Vpcs = (props) => {

    const { keyedState, hide } = props;
    const all = useSearchParams()[0]?.get("all")?.toLowerCase() === "true";
    const vpcs = useFetch(`/aws/vpcs${all ? "/all" : ""}`, { cache: true });

    return <div style={{marginBottom:"8pt"}}>
        <div>
           <b>AWS VPCs</b>&nbsp;&nbsp;{!vpcs.loading && <small>({vpcs?.length})</small>}
           <div style={{float:"right",marginRight:"3pt"}}>
                <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={hide}>{Char.X}</b>
           </div>
        </div>
        <div style={{width:"100%"}}>
            { vpcs.loading && <div className="box" style={{marginTop:"2pt"}}><StandardSpinner label="Loading VPCs" /></div> }
            { vpcs.map(vpc => <div key={vpc.id}>
                <Vpc vpc={vpc} keyedState={keyedState?.keyed(vpc.id)} />
            </div>)}
        </div>
    </div>
}

const Vpc = (props) => {

    const { vpc, keyedState } = props;
    const [ state, setState ] = useKeyedState(keyedState);

    const isShow = (property) => state[property];
    const toggleShow = (property) => setState({ [property]: state[property] ? false : true });

    const isShowSubnetsPublic  = () => isShow    ("showSubnetsPublic");
    const toggleSubnetsPublic  = () => toggleShow("showSubnetsPublic");
    const isShowSubnetsPrivate = () => isShow    ("showSubnetsPrivate");
    const toggleSubnetsPrivate = () => toggleShow("showSubnetsPrivate");
    const isShowSecurityGroups = () => isShow    ("showSecurityGroups");
    const toggleSecurityGroups = () => toggleShow("showSecurityGroups");
    const isShowTags           = () => isShow    ("showTags");
    const toggleTags           = () => toggleShow("showTags");

    return <>
        <div className="box margin" style={{marginBottom:"8pt",minWidth:"350pt",maxWidth:"500pt"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>VPC</b>: <b style={{color:"black"}}>{vpc.name}</b>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#VpcDetails:VpcId=${vpc.id}`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
            </div>
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{vpc.id}</td>
                </tr>
                { (vpc?.stack) &&
                    <tr>
                        <td style={tdLabelStyle}>Stack:</td>
                        <td style={tdContentStyle}>{vpc?.stack}</td>
                    </tr>
                }
                <tr>
                    <td style={tdLabelStyle}>CIDR:</td>
                    <td style={tdContentStyle}>{vpc?.cidr}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Status:</td>
                    <td style={tdContentStyle}>{vpc?.status}</td>
                </tr>
                <tr><td style={{height:"2pt"}} colSpan="2"></td></tr>
                <tr><td style={{height:"1px",background:"var(--box-fg)"}} colSpan="2"></td></tr>
                <tr><td style={{height:"2pt"}} colSpan="2"></td></tr>
                <tr onClick={() => toggleSubnetsPublic(vpc.id)} className="pointer">
                    <td style={tdLabelStyle}>Public Subnets:</td>
                    <td>
                        {(isShowSubnetsPublic()) ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                { (isShowSubnetsPublic()) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <Subnets type="public" vpcId={vpc?.id} notitle={true} keyedState={keyedState?.keyed("subnets-public")} />
                        </td>
                    </tr>
                </>}
                <tr onClick={toggleSubnetsPrivate} className="pointer">
                    <td style={tdLabelStyle}>Private Subnets:</td>
                    <td>
                        {(isShowSubnetsPrivate()) ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                { (isShowSubnetsPrivate()) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <Subnets type="private" vpcId={vpc?.id} notitle={true} keyedState={keyedState?.keyed("subnets-private")} />
                        </td>
                    </tr>
                </>}
                <tr onClick={toggleSecurityGroups} className="pointer">
                    <td style={tdLabelStyle}>Security Groups:</td>
                    <td>
                        {isShowSecurityGroups() ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                { (isShowSecurityGroups()) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <SecurityGroups vpcId={vpc?.id} notitle={true} keyedState={keyedState?.keyed("security-groups")} />
                        </td>
                    </tr>
                </>}
                <tr onClick={toggleTags} className="pointer">
                    <td style={tdLabelStyle}>Tags:</td>
                    <td>
                        {isShowTags() ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                { (isShowTags()) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <Tags tags={vpc?.tags} />
                        </td>
                    </tr>
                </>}
            </tbody></table>
        </div>
    </>
}

const Subnets = (props) => {
    const { vpcId, type, hide, notitle, keyedState } = props;
    const all = useSearchParams()[0].get("all")?.toLowerCase() === "true";
    const args = vpcId ? `?vpc=${vpcId}` : ""
    const subnets = useFetch(`/aws/subnets${all ? "/all" : ""}${args}`, { cache: true });
    return <div style={{marginBottom:"8pt"}}>
        { !notitle && <div>
            <b>AWS {type === "public" ? "Public" : (type === "private" ? "Private" : "")} Subnets</b>&nbsp;&nbsp;<small>({subnets?.length})</small>
            <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={hide}>{Char.X}</b>
        </div> }
        <div style={{minWidth:"400pt"}}>
            { subnets.loading && <div className="box lighten" style={{marginTop:"2pt"}}><StandardSpinner label="Loading Subnets" /></div> }
            { subnets.filter(subnet => type ? subnet.type === type : true)?.map(subnet => <div key={subnet.id}>
                <Subnet subnet={subnet} keyedState={keyedState?.keyed(subnet.id)} />
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </div>
}

const Subnet = (props) => {
    const { subnet, keyedState } = props;
    const [ state, setState ] = useKeyedState(keyedState, false);
    const isShowTags = () => state;
    const toggleTags = () => setState(!state);
    return <>
        <div className={"box margin" + (subnet?.type === "private" ? " darken" : " lighten")} style={{width:"100%"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>Subnet</b>: <b style={{color:"black"}}>{subnet?.name}</b>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#SubnetDetails:subnetId=${subnet?.id}`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
                <small style={{float:"right"}}>
                    {subnet?.type === "private" ? <> <b style={{color:"red"}}>PRIVATE</b> </>:<> <b style={{color:"green"}}>PUBLIC</b> </>}
                 </small>
            </div>
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{subnet?.id}<br /><small>{subnet?.subnet_arn}</small></td>
                </tr>
                { (subnet?.stack) &&
                    <tr>
                        <td style={tdLabelStyle}>Stack:</td>
                        <td style={tdContentStyle}>{subnet?.stack}</td>
                    </tr>
                }
                <tr>
                    <td style={tdLabelStyle}>CIDR:</td>
                    <td style={tdContentStyle}>{subnet?.cidr}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Zone:</td>
                    <td style={tdContentStyle}>{subnet?.zone}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>VPC:</td>
                    <td style={tdContentStyle}>{subnet?.vpc}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Status:</td>
                    <td style={tdContentStyle}>{subnet?.status}</td>
                </tr>
                <tr><td style={{height:"4pt"}} colSpan="2"></td></tr>
                <tr><td style={{height:"1px",background:"var(--box-fg)"}} colSpan="2"></td></tr>
                <tr><td style={{height:"2pt"}} colSpan="2"></td></tr>
                <tr onClick={toggleTags} className="pointer">
                    <td style={tdLabelStyle}>Tags:</td>
                    <td>
                        {isShowTags() ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                { (isShowTags()) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <Tags tags={subnet?.tags} />
                        </td>
                    </tr>
                </>}
            </tbody></table>
        </div>
    </>
}

const SecurityGroups = (props) => {
    const { vpcId, notitle, keyedState, hide } = props;
    const all = useSearchParams()[0].get("all")?.toLowerCase() === "true";
    const args = vpcId ? `?vpc=${vpcId}` : ""
    const securityGroups = useFetch(`/aws/security_groups${all ? "/all" : ""}${args}`, { cache: true });
    return <div style={{marginBottom:"8pt"}}>
        { !notitle &&
            <div>
                <b>AWS Security Groups</b>&nbsp;&nbsp;<small>({securityGroups?.length})</small>
                <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={hide}>{Char.X}</b>
            </div>
        }
        <div style={{minWidth:"400pt"}}>
            { securityGroups.loading && <div className="box lighten" style={{marginTop:"2pt"}}><StandardSpinner label="Loading security groups" /></div> }
            { securityGroups.map(securityGroup => <div key={securityGroup.id}>
                <SecurityGroup securityGroup={securityGroup} keyedState={keyedState?.keyed(securityGroup.id)} />
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </div>
}

const SecurityGroup = (props) => {

    const { securityGroup, keyedState } = props;
    const [ state, setState ] = useKeyedState(keyedState);

    const isShow = (property) => state[property];
    const toggleShow = (property) => setState({ [property]: state[property] ? false : true });

    const isShowRules         = () => isShow    ("showRules");
    const toggleRules         = () => toggleShow("showRules");
    const isShowInboundRules  = () => isShow    ("showInboundRules");
    const toggleInboundRules  = () => toggleShow("showInboundRules");
    const isShowOutboundRules = () => isShow    ("showOutboundRules");
    const toggleOutboundRules = () => toggleShow("showOutboundRules");
    const isShowTags          = () => isShow    ("showTags");
    const toggleTags          = () => toggleShow("showTags");

    return <>
        <div className="box margin lighten" style={{width:"100%",maxWidth:"500pt"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>Security Group</b>: <b style={{color:"black"}}>{securityGroup?.name}</b>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#SecurityGroup:groupId=${securityGroup?.id}`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
            </div>
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>ID:</td>
                    <td style={tdContentStyle}>{securityGroup?.id}<br /><small>{securityGroup?.securityGroup}</small></td>
                </tr>
                { securityGroup?.stack &&
                    <tr>
                        <td style={tdLabelStyle}>Stack:</td>
                        <td style={tdContentStyle}>{securityGroup?.stack}</td>
                    </tr>
                }
                <tr>
                    <td style={tdLabelStyle}>Description:</td>
                    <td style={{whiteSpace:"break-spaces",wordBreak:"break-all"}}>{securityGroup?.description}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>VPC:</td>
                    <td style={tdContentStyle}>{securityGroup?.vpc}</td>
                </tr>
                <tr><td style={{height:"4pt"}} colSpan="2"></td></tr>
                <tr><td style={{height:"1px",background:"var(--box-fg)"}} colSpan="2"></td></tr>
                <tr><td style={{height:"2pt"}} colSpan="2"></td></tr>
                <tr onClick={toggleInboundRules} className="pointer">
                    <td style={tdLabelStyle}>Inbound Rules:</td>
                    <td>
                        {(isShowInboundRules()) ? <>
                            <small><u>Hide</u>&nbsp;{Char.DownArrowHollow}</small>
                        </>:<>
                            <small><u>Show</u>&nbsp;{Char.UpArrowHollow}</small>
                        </>}
                    </td>
                </tr>
                {(isShowInboundRules()) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <SecurityGroupRules securityGroupId={securityGroup?.id} direction="inbound" />
                        </td>
                    </tr>
                </>}
                <tr onClick={toggleOutboundRules} className="pointer">
                    <td style={tdLabelStyle}>Outbound Rules:</td>
                    <td>
                        {(isShowOutboundRules()) ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                {(isShowOutboundRules()) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <SecurityGroupRules securityGroupId={securityGroup?.id} direction="outbound" />
                        </td>
                    </tr>
                </>}
                <tr onClick={toggleTags} className="pointer">
                    <td style={tdLabelStyle}>Tags:</td>
                    <td>
                        {(isShowTags()) ? <>
                            <small><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                    </td>
                </tr>
                {(isShowTags()) && <>
                    <tr>
                        <td style={{paddingTop:"2pt"}} colSpan="2">
                            <Tags tags={securityGroup?.tags} />
                        </td>
                    </tr>
                </>}
            </tbody></table>
        </div>
    </>
}

const SecurityGroupRules = (props) => {
    const { securityGroupId, direction } = props;
    const args = direction === "inbound" ? "?direction=inbound" : (direction === "outbound" ? "?direction=outbound" : "");
    const rules = useFetch(`/aws/security_group_rules/${securityGroupId}${args}`, { cache: true });
    return <>
        { rules.loading && <div className="box lighten" style={{paddingBottom:"10pt"}}><StandardSpinner label="Loading security group rules" /></div> }
        {rules?.map(rule => <div key={rule.id}>
            <SecurityGroupRule securityGroupRule={rule} />
            <div style={{height:"4pt"}} />
        </div>)}
    </>
}

const SecurityGroupRule = (props) => {

    const { securityGroupRule } = props;

    function getType(securityGroupRule) {
        if (securityGroupRule?.protocol?.toUpperCase() === "TCP") {
            if ((securityGroupRule?.port_from === 22) && (securityGroupRule?.port_thru === 22)) {
                return "SSH";
            }
            else if ((securityGroupRule?.port_from === 443) && (securityGroupRule?.port_thru === 443)) {
                return "HTTPS";
            }
            else if ((securityGroupRule?.port_from === 80) && (securityGroupRule?.port_thru === 80)) {
                return "HTTP";
            }
        }
        return securityGroupRule?.protocol?.toUpperCase();
    }

    function getProtocol(securityGroupRule) {
        if ((securityGroupRule?.port_from === 3) && (securityGroupRule?.port_thru === -1)) {
            return "Destination Unreachable";
        }
        else if ((securityGroupRule?.port_from === 4) && (securityGroupRule?.port_thru === -1)) {
            return "Source Quench";
        }
        else if ((securityGroupRule?.port_from === 8) && (securityGroupRule?.port_thru === -1)) {
            return "Echo Request";
        }
        else if ((securityGroupRule?.port_from === 11) && (securityGroupRule?.port_thru === -1)) {
            return "Time Exceeded";
        }
        return securityGroupRule?.protocol?.toUpperCase();
    }

    function getPorts(securityGroupRule) {
        if ((securityGroupRule?.port_from < 0) && (securityGroupRule?.port_thru < 0)) {
            return null;
        }
        else if ((securityGroupRule?.port_from === 3) && (securityGroupRule?.port_thru === -1)) {
            return null;
        }
        else if ((securityGroupRule?.port_from === 4) && (securityGroupRule?.port_thru === -1)) {
            return null;
        }
        else if ((securityGroupRule?.port_from === 8) && (securityGroupRule?.port_thru === -1)) {
            return null;
        }
        else if ((securityGroupRule?.port_from === 11) && (securityGroupRule?.port_thru === -1)) {
            return null;
        }
        else {
            if (securityGroupRule?.port_from === securityGroupRule?.port_thru) {
                return securityGroupRule?.port_from
            }
            else {
                return `${securityGroupRule?.port_from} - ${securityGroupRule?.port_thru}`;
            }
        }
    }

    return <>
        <div className="box" style={{background:"#FEFEFE",width:"100%"}}>
            <div style={{borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"4pt"}}>
                <b>Security Group Rule</b>: <b style={{color:"black"}}>{securityGroupRule?.id}</b>
                <small style={{float:"right"}}>
                    <b style={{color:securityGroupRule?.egress ? "var(--box-fg)" : "red"}}>{securityGroupRule?.egress ? "OUTBOUND" : "INBOUND"}</b>
                </small>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#ModifyInboundSecurityGroupRules:securityGroupId=${securityGroupRule?.security_group}`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
            </div>
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>Direction:</td>
                    <td style={tdContentStyle}>{securityGroupRule?.egress ? "Outbound" : "Inbound"}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Protocol:</td>
                    <td style={tdContentStyle}>{getProtocol(securityGroupRule)}</td>
                </tr>
                {(getType(securityGroupRule) !== getProtocol(securityGroupRule)) &&
                    <tr>
                        <td style={tdLabelStyle}>Type:</td>
                        <td style={tdContentStyle}>{getType(securityGroupRule)}</td>
                    </tr>
                }
                {(getPorts(securityGroupRule)) &&
                    <tr>
                        <td style={tdLabelStyle}>Port:</td>
                        <td style={tdContentStyle}>{getPorts(securityGroupRule)}</td>
                    </tr>
                }
                {securityGroupRule?.cidr &&
                    <tr>
                        <td style={tdLabelStyle}>CIDR:</td>
                        <td style={tdContentStyle}>{securityGroupRule?.cidr}</td>
                    </tr>
                }
                {securityGroupRule?.description &&
                    <tr>
                        <td style={tdLabelStyle}>Description:</td>
                        <td style={{whiteSpace:"break-spaces",wordBreak:"break-all"}}>{securityGroupRule?.description}</td>
                    </tr>
                }
                <tr>
                    <td style={tdLabelStyle}>Security Group:</td>
                    <td style={tdContentStyle}>{securityGroupRule?.security_group}</td>
                </tr>
            </tbody></table>
        </div>
    </>
}

const Tags = (props) => {
    return <div style={{maxWidth:"480pt"}}>
        <div className="box lighten">
            { !props.tags ? <>
                <li>No tags.</li>
            </>:<>
                <ul style={{marginBottom:"1pt"}}>
                    { props.tags && Object.keys(props.tags)?.map(key => <li key={key}>
                        <b>{key}</b> <br />
                        <div style={{wordBreak:"break-all"}}>
                            { props.tags[key] === "********" ? <>
                                <span style={{color:"red"}}>REDACTED</span>
                            </>:<>
                                {props.tags[key]}
                            </>}
                        </div>
                    </li>)}
                </ul>
            </>}
        </div>
    </div>
}

const StackList = (props) => {
    const stacks = useFetch("/aws/stacks", { cache: true });
    const styleLast = { cursor: "pointer" };
    const styleNotLast = { ...styleLast, borderBottom:"1px solid var(--box-fg)",paddingBottom:"2pt",marginBottom:"2pt" };
    return <>
        <div><b>AWS Stacks</b></div>
        <div className="box" style={{whiteSpace:"nowrap"}}>
            { stacks.loading && <StandardSpinner label="Loading stacks" /> }
            {stacks.map((stack, i) => {
                const toggleStack = () => props.toggleStack(stack.name);
                const selectedStack = () => props.selectedStack(stack.name);
                const style = {...(i + 1 < stacks.length ? styleNotLast : styleLast), ...(selectedStack(stack.name) ? {fontWeight:"bold"} : {})};
                return <div key={stack.name} style={style} onClick={toggleStack}>{stack.name}</div>
            })}
        </div>
    </>
}

const Stack = (props) => {

    const { stackName, keyedState, hide } = props;
    const [ state, setState ] = useKeyedState(keyedState);

    const stack = useFetch(`/aws/stacks/${stackName}`, { cache: true });

    const isShow = (property) => state[property];
    const toggleShow = (property) => setState({ [property]: state[property] ? false : true });

    const isShowOutputs    = () => isShow    ("showOutputs");
    const toggleOutputs    = () => toggleShow("showOutputs");
    const isShowParameters = () => isShow    ("showParameters");
    const toggleParameters = () => toggleShow("showParameters");
    const isShowResources  = () => isShow    ("showResources");
    const toggleResources  = () => toggleShow("showResources");
    const isShowTemplate   = () => isShow    ("showTemplate");
    const toggleTemplate   = () => toggleShow("showTemplate");

    return <div style={{maxWidth:"500pt",marginBottom:"8pt"}}>
        <div>
            <b>AWS Stack: {stackName}</b>
            <ExternalLink
                href={`https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/stackinfo?filteringStatus=active&filteringText=&viewNested=true&stackId=${stack.data?.id}`}
                bold={true}
                style={{marginLeft:"6pt"}} />
        </div>
        <div className="box margin">
            { stack.loading ?
                <StandardSpinner label="Loading stack info" />
            : 
            <table width="100%"><tbody>
                <tr>
                    <td style={tdLabelStyle}>Name:</td>
                    <td style={{...tdContentStyle,wordBreak:"break-all"}}>
                        <b style={{float:"right",cursor:"pointer",marginTop:"-2pt"}} onClick={hide}>{Char.X}</b>
                        {stackName}
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
                <tr>
                    <td style={tdLabelStyle}>Outputs:</td>
                    <td style={tdContentStyle}>
                        { isShowOutputs() ? <>
                            <small className="pointer" onClick={toggleOutputs}><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small className="pointer" onClick={toggleOutputs}><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                        <ExternalLink
                            href={`https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/outputs?filteringStatus=active&filteringText=&viewNested=true&stackId=${stack.data?.id}`}
                            bold={true}
                            style={{fontSize:"small",marginLeft:"10pt"}} />
                    </td>
                </tr>
                { isShowOutputs() && <>
                    <tr>
                        <td colSpan="2" style={{paddingTop:"2pt"}}>
                            <StackOutputs stackName={stackName} />
                        </td>
                    </tr>
                </>}
                <tr>
                    <td style={tdLabelStyle}>Parameters:</td>
                    <td style={tdContentStyle}>
                        { isShowParameters() ? <>
                            <small className="pointer" onClick={toggleParameters}><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small className="pointer" onClick={toggleParameters}><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                        <ExternalLink
                            href={`https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/parameters?filteringStatus=active&filteringText=&viewNested=true&stackId=${stack.data?.id}`}
                            bold={true}
                            style={{fontSize:"small",marginLeft:"10pt"}} />
                    </td>
                </tr>
                { isShowParameters() && <>
                    <tr>
                        <td colSpan="2" style={{paddingTop:"2pt"}}>
                            <StackParameters stackName={stackName} />
                        </td>
                    </tr>
                </>}
                <tr>
                    <td style={tdLabelStyle}>Resources:</td>
                    <td style={tdContentStyle}>
                        { isShowResources() ? <>
                            <small className="pointer" onClick={toggleResources}><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small className="pointer" onClick={toggleResources}><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                        <ExternalLink
                            href={`https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/resources?filteringStatus=active&filteringText=&viewNested=true&stackId=${stack.data?.id}`}
                            bold={true}
                            style={{fontSize:"small",marginLeft:"10pt"}} />
                    </td>
                </tr>
                { isShowResources() && <>
                    <tr>
                        <td colSpan="2" style={{paddingTop:"2pt"}}>
                            <StackResources stackName={stackName} />
                        </td>
                    </tr>
                </>}
                <tr>
                    <td style={tdLabelStyle}>Template:</td>
                    <td style={tdContentStyle}>
                        { isShowTemplate() ? <>
                            <small className="pointer" onClick={toggleTemplate}><u>Hide&nbsp;{Char.DownArrowHollow}</u></small>
                        </>:<>
                            <small className="pointer" onClick={toggleTemplate}><u>Show&nbsp;{Char.UpArrowHollow}</u></small>
                        </>}
                        <ExternalLink
                            href={`https://us-east-1.console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/template?filteringStatus=active&filteringText=&viewNested=true&stackId=${stack.data?.id}`}
                            bold={true}
                            style={{fontSize:"small",marginLeft:"10pt"}} />
                    </td>
                </tr>
                { isShowTemplate() && <>
                    <tr>
                        <td colSpan="2" style={{paddingTop:"2pt"}}>
                            <StackTemplate stackName={stackName} />
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
                    <li>No stack outputs.</li>
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
                    <li>No stack parameters.</li>
                </>}
            </>:<>
                <ul style={{marginBottom:"1pt"}}>
                    { parameters.data && Object.keys(parameters.data)?.map(parameter => <li key={parameter}>
                        <b>{parameter}</b> <br />
                        <div style={{wordBreak:"break-all"}}>
                            { parameters.data[parameter] === "********" ? <>
                                <span style={{color:"red"}}>REDACTED</span>
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
                    <li>No stack resources.</li>
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

const StackTemplate = (props) => {
    const template = useFetch(`/aws/stacks/${props.stackName}/template`, { cache: true });
    return <div style={{maxWidth:"480pt"}}>
        <div className="box lighten nomargin">
            { template.empty ? <>
                { template.loading ? <>
                    <StandardSpinner label="Loading stack template" />
                </>:<>
                    <li>No stack template.</li>
                </>}
            </>:<>
                { template.data &&
                    <pre style={{border:"0",background:"var(--box-bg-lighten)",marginLeft:"-6pt",marginTop:"-6pt",marginBottom:"-6pt"}}>
                        {Type.IsObject(template.data) ? Json.Format(template.data) : template.data}
                    </pre>
                }
            </>}
        </div>
    </div>
}

const Gac = (props) => {
    const { hide } = props;
    const info = useFetch("/info", { cache: true });
    return <div style={{maxWidth:"500pt",marginBottom:"8pt"}}>
        <div style={{wordBreak:"break-all"}}><b>GAC</b>:&nbsp;<b>{info.data?.gac?.name}</b>&nbsp;
            <ExternalLink
                href={`https://us-east-1.console.aws.amazon.com/secretsmanager/secret?name=${info.data?.gac?.name}&region=us-east-1`}
                bold={true}
                style={{marginLeft:"6pt"}} />
                <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={hide}>{Char.X}</b>
        </div>
        <div className="box margin">
            { info.loading && <StandardSpinner label="Loading GAC" /> }
            <ul style={{marginBottom:"1pt"}}>
                { info.data?.gac && Object.keys(info.data.gac.values)?.map(name => <li key={name}>
                    <b>{name}</b> <br />
                    { info.data.gac.values[name] === "********" ? <span style={{color:"red"}}>REDACTED</span> : info.data.gac.values[name] }
                </li>)}
            </ul>
        </div>
    </div>
}

const Ecosystem = (props) => {
    const { hide } = props;
    const info = useFetch("/info", { cache: true });
    return <div style={{maxWidth:"500pt",marginBottom:"8pt"}}>
        <div>
            <b>Ecosystem</b>:&nbsp;<b>{info.data?.buckets?.env}</b>
            <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={hide}>{Char.X}</b>
        </div>
        <pre className="box margin">
            { info.loading && <StandardSpinner label="Loading Ecosystem" /> }
            {!info.loading && Yaml.Format(info.data?.buckets?.ecosystem) }
        </pre>
    </div>
}

export default InfrastructurePage;
