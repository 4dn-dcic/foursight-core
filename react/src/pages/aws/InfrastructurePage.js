import React from 'react';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StandardSpinner } from '../../Spinners';
import useFetch from '../../hooks/Fetch';
import { ExternalLink } from '../../Components';
import Char from '../../utils/Char';
import Clipboard from '../../utils/Clipboard';
import DateTime from '../../utils/DateTime';
import Image from '../../utils/Image';
import Json from '../../utils/Json';
import JsonToggleDiv from '../../components/JsonToggleDiv';
import Str from '../../utils/Str';
import Tooltip from '../../components/Tooltip';
import Type from '../../utils/Type';
import Uuid from 'react-uuid';
import Yaml from '../../utils/Yaml';
import useSelectedComponents from '../../hooks/SelectedComponents';
import useKeyedState from '../../hooks/KeyedState';
import useUrlArgs from '../../hooks/UrlArgs';
import { SecretNameList, Secrets, SecretView, Gac } from './Secrets';
import { HorizontalLine } from '../../Components';

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

function isRedacted(s) {
    return /^\*+$/.test(s);
}

const InfrastructurePage = () => {

    const keyedState = useKeyedState();
    const urlArgs = useUrlArgs()

    const componentDefinitions = [
         { type: "stack",           create: createStack          },
         { type: "vpcs",            create: createVpcs           },
         { type: "subnets-public",  create: createSubnetsPublic  },
         { type: "subnets-private", create: createSubnetsPrivate },
         { type: "security-groups", create: createSecurityGroups },
         { type: "gac",             create: createGac            },
         { type: "secrets",         create: createSecrets        },
         { type: "ecosystem",       create: createEcosystem      },
         { type: "ecs-clusters",    create: createEcsClusters    },
         { type: "ecs-tasks",       create: createEcsTasks       }
    ];

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

    function createSecrets(name, key, unselect, args) {
        function hide() {
            urlArgs.unsetList("secrets", name);
            return unselect();
        }
        return <Secrets name={name} hide={hide} />;
    }

    function createEcosystem(name, key, unselect, args) {
        return <Ecosystem hide={unselect} />;
    }

    function createStack(name, key, unselect, args) {
        const { keyedState } = args;
        return <Stack stackName={name} keyedState={keyedState.keyed(key)} hide={unselect} />;
    }

    function createEcsClusters(name, key, unselect, args) {
        const { keyedState } = args;
        return <EcsClusters keyedState={keyedState.keyed(key)} hide={unselect} />;
    }

    function createEcsTasks(name, key, unselect, args) {
        const { keyedState } = args;
        return <EcsTasks keyedState={keyedState.keyed(key)} hide={unselect} />;
    }

    const selectedVpcs           = () => componentsLeft.selected("vpcs");
    const toggleVpcs             = () => componentsLeft.toggle("vpcs");

    const selectedGac            = () => componentsLeft.selected("gac");
    const toggleGac              = () => componentsLeft.toggle("gac");

    const selectedEcosystem      = () => componentsLeft.selected("ecosystem");
    const toggleEcosystem        = () => componentsLeft.toggle("ecosystem");

    const selectedStack          = (stackName) => componentsLeft.selected("stack", stackName);
    const toggleStack            = (stackName) => componentsLeft.toggle("stack", stackName);

    const selectedSubnetsPublic  = () => componentsRight.selected("subnets-public");
    const toggleSubnetsPublic    = () => componentsRight.toggle("subnets-public");

    const selectedSubnetsPrivate = () => componentsRight.selected("subnets-private");
    const toggleSubnetsPrivate   = () => componentsRight.toggle("subnets-private");

    const selectedSecurityGroups = () => componentsRight.selected("security-groups");
    const toggleSecurityGroups   = () => componentsRight.toggle("security-groups");

    const selectedSecrets        = (secretName) => componentsLeft.selected("secrets", secretName);
    const toggleSecrets          = (secretName) => componentsLeft.toggle("secrets", secretName) ? urlArgs.setList("secrets", secretName) : urlArgs.unsetList("secrets", secretName);
    const selectSecrets          = (secretName) => { componentsLeft.select("secrets", secretName) ; urlArgs.setList("secrets", secretName) };

    const selectedEcsClusters    = () => componentsLeft.selected("ecs-clusters");
    const toggleEcsClusters      = () => componentsLeft.toggle("ecs-clusters");

    const selectedEcsTasks       = () => componentsLeft.selected("ecs-tasks");
    const toggleEcsTasks         = () => componentsLeft.toggle("ecs-tasks");

    useEffect(() => {
        toggleVpcs();
        toggleEcosystem();
        for (let secretsName of urlArgs.getList("secrets")) {
            selectSecrets(secretsName);
        }
        toggleEcsClusters();
        toggleEcsTasks();
    }, []);

    return <table><tbody><tr>
        <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
            <ConfigList
                showGac={selectedGac} toggleGac={toggleGac}
                showEcosystem={selectedEcosystem} toggleEcosystem={toggleEcosystem} />
            <NetworkList
                keyedState={keyedState}
                showVpcs={selectedVpcs} toggleVpcs={toggleVpcs}
                showSubnetsPublic={selectedSubnetsPublic} toggleSubnetsPublic={toggleSubnetsPublic}
                showSubnetsPrivate={selectedSubnetsPrivate} toggleSubnetsPrivate={toggleSubnetsPrivate}
                showSecurityGroups={selectedSecurityGroups} toggleSecurityGroups={toggleSecurityGroups}
            />
            <EcsList
                showEcsClusters={selectedEcsClusters} toggleEcsClusters={toggleEcsClusters}
                showEcsTasks={selectedEcsTasks} toggleEcsTasks={toggleEcsTasks}
            />
            <SecretNameList
                toggleSecrets={toggleSecrets}
                selectedSecrets={selectedSecrets}
            />
            <StackList
                toggleStack={toggleStack}
                selectedStack={selectedStack}
            />
        </td>
        { !componentsLeft.empty() &&
            <td style={{verticalAlign:"top", paddingRight:"8pt"}}>
                { componentsLeft.map(component => <div key={component.key}>{component.ui({ keyedState: keyedState })}</div>) }
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
            <div className="pointer" style={{fontWeight:showVpcs() ? "bold" : "normal"}} onClick={toggleVpcs}>VPCs</div>
			<HorizontalLine top="2pt" bottom="2pt" />
            <div className="pointer" style={{fontWeight:showSubnetsPublic() ? "bold" : "normal"}} onClick={toggleSubnetsPublic}>Public Subnets</div>
			<HorizontalLine top="2pt" bottom="2pt" />
            <div className="pointer" style={{fontWeight:showSubnetsPrivate() ? "bold" : "normal"}} onClick={toggleSubnetsPrivate}>Private Subnets</div>
			<HorizontalLine top="2pt" bottom="2pt" />
            <div className="pointer" style={{fontWeight:showSecurityGroups() ? "bold" : "normal"}} onClick={toggleSecurityGroups}>Security Groups</div>
        </div>
    </>
}

const EcsList = (props) => {
    const { showEcsClusters, toggleEcsClusters } = props;
    const { showEcsTasks, toggleEcsTasks } = props;
    return <>
        <div><b>AWS Elastic Container Service</b></div>
        <div className="box margin" style={{width:"100%",marginBottom:"6pt"}}>
            <div className="pointer" style={{fontWeight:showEcsClusters() ? "bold" : "normal"}} onClick={toggleEcsClusters}>Clusters</div>
			<HorizontalLine top="2pt" bottom="2pt" />
            <div className="pointer" style={{fontWeight:showEcsTasks() ? "bold" : "normal"}} onClick={toggleEcsTasks}>Task Definitions</div>
        </div>
    </>
}

const ConfigList = (props) => {
    const { showGac, toggleGac, showEcosystem, toggleEcosystem } = props;
    return <>
        <div><b>AWS Configuration</b></div>
        <div className="box margin" style={{width:"100%",marginBottom:"6pt"}}>
            <div className="pointer" style={{fontWeight:showEcosystem() ? "bold" : "normal"}} onClick={toggleEcosystem}>Ecosystem Definition</div>
			<HorizontalLine top="3pt" bottom="3pt" />
            <div className="pointer" style={{fontWeight:showGac() ? "bold" : "normal"}} onClick={toggleGac}>Global Application Configuration</div>
        </div>
    </>
}

const Vpcs = (props) => {

    const { keyedState, hide } = props;
    const all = useSearchParams()[0]?.get("all")?.toLowerCase() === "true";
    const vpcs = useFetch(`/aws/vpcs${all ? "/all" : ""}`, { cache: true });

    return <div style={{width:"100%",maxWidth:"100%",marginBottom:"8pt"}}>
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
        <div className="box margin" style={{marginBottom:"8pt",width:"100%",minWidth:"350pt",maxWidth:"100%"}}>
            <div>
                <b>VPC</b>: <b style={{color:"black"}}>{vpc.name}</b>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#VpcDetails:VpcId=${vpc.id}`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
                <HorizontalLine top="2pt" bottom="2pt" />
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
                <HorizontalLine top="2pt" bottom="2pt" table={2} />
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
            { subnets.loading && <div className="box lighten" style={{marginTop:"2pt"}}><StandardSpinner label="Loading subnets" /></div> }
            { subnets.filter(subnet => type ? subnet.type === type : true)?.map(subnet => <div key={subnet.id}>
                <Subnet subnet={subnet} keyedState={keyedState?.keyed(subnet.id)} />
                <div style={{height:"4pt"}} />
            </div>)}
        </div>
    </div>
}

const Subnet = (props) => {
    const { subnet, keyedState } = props;
    const [ state, setState ] = useKeyedState(keyedState);
    const isShow = (property) => state[property];
    const toggleShow = (property) => setState({ [property]: state[property] ? false : true });
    const isShowTags = () => isShow    ("showTags");
    const toggleTags = () => toggleShow("showTags");
    return <>
        <div className={"box margin" + (subnet?.type === "private" ? " darken" : " lighten")} style={{width:"100%"}}>
            <div>
                <b>Subnet</b>: <b style={{color:"black"}}>{subnet?.name}</b>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#SubnetDetails:subnetId=${subnet?.id}`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
                <small style={{float:"right"}}>
                    {subnet?.type === "private" ? <> <b style={{color:"red"}}>PRIVATE</b> </>:<> <b style={{color:"green"}}>PUBLIC</b> </>}
                </small>
                <HorizontalLine top="2pt" bottom="2pt" />
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
                <HorizontalLine top="4pt" bottom="2pt" table={2} />
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
    return <div style={{width:"100%",maxWidth:"100%",marginBottom:"8pt"}}>
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

    const isShowInboundRules  = () => isShow    ("showInboundRules");
    const toggleInboundRules  = () => toggleShow("showInboundRules");
    const isShowOutboundRules = () => isShow    ("showOutboundRules");
    const toggleOutboundRules = () => toggleShow("showOutboundRules");
    const isShowTags          = () => isShow    ("showTags");
    const toggleTags          = () => toggleShow("showTags");

    return <>
        <div className="box margin lighten" style={{width:"100%",maxWidth:"100%"}}>
            <div>
                <b>Security Group</b>: <b style={{color:"black"}}>{securityGroup?.name}</b>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#SecurityGroup:groupId=${securityGroup?.id}`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
                <HorizontalLine top="2pt" bottom="2pt" />
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
                <HorizontalLine top="4pt" bottom="2pt" table={2} />
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
            <div>
                <b>Security Group Rule</b>: <b style={{color:"black"}}>{securityGroupRule?.id}</b>
                <small style={{float:"right"}}>
                    <b style={{color:securityGroupRule?.egress ? "var(--box-fg)" : "red"}}>{securityGroupRule?.egress ? "OUTBOUND" : "INBOUND"}</b>
                </small>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/vpc/home?region=us-east-1#ModifyInboundSecurityGroupRules:securityGroupId=${securityGroupRule?.security_group}`}
                    bold={true}
                    style={{marginLeft:"6pt"}} />
                <HorizontalLine top="2pt" bottom="2pt" />
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
    return <div style={{width:"100%",maxWidth:"100%"}}>
        <div className="box lighten">
            { !props.tags ? <>
                <li>No tags.</li>
            </>:<>
                <ul style={{marginBottom:"1pt"}}>
                    { props.tags && Object.keys(props.tags)?.map(key => <li key={key}>
                        <b>{key}</b> <br />
                        <div style={{wordBreak:"break-all"}}>
                            { isRedacted(props.tags[key]) ? <>
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
    return <>
        <div><b>AWS Stacks</b></div>
        <div className="box" style={{whiteSpace:"nowrap",marginBottom:"6pt"}}>
            { stacks.loading && <StandardSpinner label="Loading stacks" /> }
            {stacks.map((stack, i) => {
                const toggleStack = () => props.toggleStack(stack.name);
                const selectedStack = () => props.selectedStack(stack.name);
                const style = {...(selectedStack(stack.name) ? {fontWeight:"bold"} : {})};
                return <>
                    <div key={stack.name} style={style} className="pointer" onClick={toggleStack}>{stack.name}</div>
                    <HorizontalLine top="2pt" bottom="2pt" iff={i + 1 < stacks.length}/>
                </>
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

    return <div style={{width:"100%",maxWidth:"100%",marginBottom:"8pt"}}> {/* xyzzy */}
        <div>
            <b>AWS Stack: {stackName}</b>
            <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={hide}>{Char.X}</b>
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
                        {/* <b style={{float:"right",cursor:"pointer",marginTop:"-2pt"}} onClick={hide}>{Char.X}</b> */}
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
                <HorizontalLine top="2pt" bottom="2pt" table={2} />
                <tr>
                    <td style={tdLabelStyle}>Status:</td>
                    <td style={tdContentStyle}>{stack.data?.status}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Created:</td>
                    <td style={tdContentStyle}>{DateTime.Format(stack.data?.created)}</td>
                </tr>
                <tr>
                    <td style={tdLabelStyle}>Updated:</td>
                    <td style={tdContentStyle}>{DateTime.Format(stack.data?.updated)}</td>
                </tr>
                <HorizontalLine top="2pt" bottom="2pt" table={2} />
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
    return <div style={{width:"100%",maxWidth:"100%",wordBreak:"break-all"}}>
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
                            { isRedacted(outputs.data[output]) ? <>
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
    return <div style={{width:"100%",maxWidth:"100%",wordBreak:"break-all"}}>
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
                            { isRedacted(parameters.data[parameter]) ? <>
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
    return <div style={{width:"100%",maxWidth:"100%",wordBreak:"break-all"}}>
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
                            { isRedacted(resources.data[resource]) ? <>
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
    return <div style={{width:"100%",maxWidth:"100%"}}>
        <div className="box lighten nomargin">
            { template.empty ? <>
                { template.loading ? <>
                    <StandardSpinner label="Loading stack template" />
                </>:<>
                    <li>No stack template.</li>
                </>}
            </>:<>
                { template.data &&
                    <pre style={{width:"100%",maxWidth:"100%",border:"0",background:"var(--box-bg-lighten)",marginLeft:"-6pt",marginTop:"-6pt",marginBottom:"-6pt"}}>
                        {Type.IsObject(template.data) ? Yaml.Format(template.data) : template.data}
                    </pre>
                }
            </>}
        </div>
    </div>
}

const Ecosystem = (props) => {
    const { hide } = props;
    const info = useFetch("/info", { cache: true });
    return <div style={{width:"100%",maxWidth:"100%",marginBottom:"8pt"}}>
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

const EcsClusters = (props) => {

    const { keyedState, hide } = props;
    const clusters = useFetch("//aws/ecs/clusters");

    return <div style={{marginBottom:"8pt"}}>
        <div>
           <b>AWS ESC Clusters</b>&nbsp;&nbsp;{!clusters.loading && <small>({clusters?.length})</small>}
            <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={hide}>{Char.X}</b>
        </div>
        <div style={{width:"100%"}} className="box lighten nomargin">
            { clusters.loading && <div><StandardSpinner label="Loading ECS clusters" /></div> }
            { clusters.map((cluster, index) => <div key={cluster?.cluster_name}>
                <EcsCluster cluster={cluster} keyedState={keyedState?.keyed(cluster?.cluster_name)} />
				{ index < clusters.length - 1 && <HorizontalLine top="2pt" bottom="2pt" dotted={true} /> }
            </div>)}
        </div>
    </div>
}

const EcsCluster = (props) => {

    const [ state, setState ] = useKeyedState(props.keyedState);
    const isShow = (property) => state[property];
    const toggleShow = (property) => setState({ [property]: state[property] ? false : true });

    const toggleShowDetail = () => toggleShow("detail");
    const isShowDetail = () => isShow("detail");

    return <div>
        <span onClick={toggleShowDetail} className="pointer" style={{fontWeight: isShowDetail() ? "bold" : "inherit"}}>{props.cluster?.cluster_name}</span>
        <ExternalLink
            href={`https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/${props.cluster?.cluster_name}/services?region=us-east-1`}
            style={{marginLeft:"6pt"}} />
        { isShowDetail() ? <>
            <EcsClusterDetail
                cluster={props.cluster}
                clusterDisplayName={props.cluster?.cluster_name}
                keyedState={props.keyedState} />
        </>:<>
        </> }
    </div>
}

const EcsClusterDetail = (props) => {
    const [ state, setState ] = useKeyedState(props.keyedState);
    const isShowServices = () => state["show-services"]
    const toggleShowServices = () => setState({ "show-services": !isShowServices() });
    const cluster = useFetch(`//aws/ecs/clusters/${encodeURIComponent(props.cluster?.cluster_name)}`, { cache: true });
    useEffect(() => {
        toggleShowServices();
    }, []);
    return <div className="box" style={{background:"inherit",marginTop:"2pt",marginBottom:"3pt",overflow:"auto"}}>
        <JsonToggleDiv data={cluster.data} yaml={true} both={true}>
            <small>
                <b>Cluster ARN</b>: {cluster.data?.cluster_arn} <br />
                <b>Status</b>: {cluster.data?.status} <br />
                <b>Deployed</b>: {DateTime.Format(cluster.data?.most_recent_deployment_at)} <br />
                <b>Services</b>: {cluster.data?.services?.length}
                { cluster.data?.services?.length > 0 && <>
                    &nbsp;
                    { isShowServices() ? <>
                        <span onClick={toggleShowServices} className="pointer">{Char.DownArrow}</span>
                        <EcsClusterServices cluster={cluster.data?.cluster_name} services={cluster.data?.services} />
                    </>:<>
                        <span onClick={toggleShowServices} className="pointer">{Char.UpArrow}</span>
                    </> }
                </> }
            </small>
        </JsonToggleDiv>
    </div>
}

const EcsClusterServices = (props) => {
    const longestCommonInitialSubstring = Str.LongestCommonInitialSubstring(props.services, service => service.service_name);
    return <div className="box bigmargin smallpadding nobackground"><ul>
        { props.services?.map((service, index) => <>
            <li>
                <b>
                    { service.service_name == service.service_display_name ? <>
                        <span onClick={() => {Clipboard.CopyText(service.service_name);}} style={{cursor:"copy"}}>
                            <b id={`tooltip-${service.service_name}`}>{service.service_name.substring(longestCommonInitialSubstring.length)}</b>
                            <Tooltip id={`tooltip-${service.service_name}`} text={service.service_name} position="right" shape="squared" />
                        </span>
                    </>:<>
                        {service.service_name}
                    </> }
                </b>
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/${props.cluster}/services/${service.service_name}/health?region=us-east-1`}
                    style={{marginLeft:"6pt"}} />
                &nbsp;|&nbsp;
                <small><b>Logs</b>
                    <ExternalLink
                        href={`https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/${props.cluster}/services/${service.service_name}/logs?region=us-east-1`}
                        style={{marginLeft:"4pt"}} />
                </small>
                <br />
                <small>
                    <b>Service ARN</b>: {service.service_arn} <br />
                    { service.service_name == service.service_display_name && <>
                        <b>Service Name</b>: Service: {service.service_display_name} <br />
                    </> }
                    <b>Task Definition</b>: {service.task_display_name}
                        <ExternalLink
                            href={`https://us-east-1.console.aws.amazon.com/ecs/v2/task-definitions/${service.task_name}?region=us-east-1`}
                            style={{marginLeft:"4pt"}} /> <br />
                    <b>Task Definition ARN</b>: {service.task_arn}
                        <ExternalLink
                            href={`https://us-east-1.console.aws.amazon.com/ecs/v2/task-definitions/${service.task_name}/1/containers?region=us-east-1`}
                            style={{marginLeft:"4pt"}} />
                </small>
                { index < props.services.length - 1 && <><br /><br /></> }
            </li>
        </>) }
    </ul></div>
}

const EcsTasks = (props) => {
    const { keyedState, hide } = props;
    const tasks = useFetch("//aws/ecs/tasks/latest");
    return <div style={{marginBottom:"8pt"}}>
        <div>
           <b>AWS ECS Tasks Definitions</b>&nbsp;&nbsp;{!tasks.loading && <small>({tasks?.length})</small>}
            <b style={{float:"right",fontSize:"small",marginTop:"2pt",marginRight:"4pt",cursor:"pointer"}} onClick={hide}>{Char.X}</b>
        </div>
        <div style={{width:"100%"}} className="box lighten nomargin">
            { tasks.loading && <div><StandardSpinner label="Loading ECS tasks" /></div> }
            { tasks.map((task, index) => <div key={task?.task_name}>
                <EcsTask task={task} keyedState={keyedState?.keyed(task?.task_name)} />
				{ index < tasks.length - 1 && <HorizontalLine top="2pt" bottom="2pt" dotted={true} /> }
            </div>)}
        </div>
    </div>
}

const EcsTask = (props) => {
    const [ state, setState ] = useKeyedState(props.keyedState);
    const isShow = (property) => state[property];
    const toggleShow = (property) => setState({ [property]: state[property] ? false : true });
    const toggleShowDetail = () => toggleShow("detail");
    const isShowDetail = () => isShow("detail");
    return <div>
        <span onClick={toggleShowDetail} className="pointer" style={{fontWeight: isShowDetail() ? "bold" : "inherit"}}>{props.task}</span>
        <ExternalLink
            href={`https://us-east-1.console.aws.amazon.com/ecs/v2/task-definitions/${props.task}?region=us-east-1`}
            style={{marginLeft:"6pt"}} />
        { isShowDetail() && <>
            <EcsTaskDetail
                task={props.task}
                keyedState={props.keyedState} />
        </> }
    </div>
}

const EcsTaskDetail = (props) => {
    const [ state, setState ] = useKeyedState(props.keyedState);
    const task = useFetch(`//aws/ecs/tasks/${encodeURIComponent(props.task)}`, { cache: true });
    useEffect(() => {
    }, []);
    const td = { fontSize: "small", verticalAlign: "top" };
    const tdl = { ...td, paddingRight: "3pt", whiteSpace: "nowrap" };
    const tdr = { ...td, whiteSpace: "break-spaces", wordBreak: "break-all" };
    return <div className="box" style={{background:"inherit",marginTop:"2pt",marginBottom:"3pt",overflow:"auto"}}>
        <JsonToggleDiv data={task.data} yaml={true} both={true}>
            <small>
            <table><tbody>
            <tr><td style={tdl}><b>Task Definition Name</b>:</td><td style={tdr}><u>{task.data?.task_display_name}</u></td></tr>
            <tr><td style={tdl}><b>Task Definition ARN</b>:</td><td style={tdr}>
                {task.data?.task_arn}
                <ExternalLink
                    href={`https://us-east-1.console.aws.amazon.com/ecs/v2/task-definitions/${task.data?.task_name}${task.data?.task_revision ? "/" + task.data.task_revision : ""}/containers?region=us-east-1`}
                    style={{marginLeft:"6pt"}} />
                </td></tr>
            <tr><td style={tdl}><b>Task Definition Revision</b>:</td><td style={tdr}>{task.data?.task_revision}</td></tr>
            </tbody></table>
            </small>
        </JsonToggleDiv>
    </div>
}

export default InfrastructurePage;
