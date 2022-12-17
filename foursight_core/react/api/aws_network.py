import boto3
import copy
import json
import re
from typing import Callable, Optional, Union
from .misc_utils import memoize


def _filter_boto_description_list(description: dict,
                                  name: str,
                                  predicate: Optional[Union[str, re.Pattern, Callable]] = None,
                                  create_record: Optional[Callable] = None) -> list:
    """
    Returns the list of AWS items from the given boto3 "describe" object (e.g. describe_vpc,
    describe_subnets, describe_security_groups) which have tags names matching the given tag
    predicate. This predicate may be (1) a string in which case it is used to match (case-sensitive)
    the tag name exactly, or as a prefix if it ends with an asterisk; or (2) a regular expression
    against which the tag name will be matched, or (3) a function which will be called with
    each tag name and which should return True iff the tag name should be considered a match.
    If no matches then returns empty list. Raises exception on error.
    """
    results = []
    if isinstance(predicate, str):
        if predicate.endswith("*"):
            predicate_filter = lambda tag: isinstance(tag, str) and tag.startswith(predicate[0:len(predicate) - 1])
        else:
            predicate_filter = lambda tag: isinstance(tag, str) and tag == predicate
    elif isinstance(predicate, re.Pattern):
        predicate_filter = lambda tag: isinstance(tag, str) and predicate.match(tag) is not None
    elif isinstance(predicate, Callable):
        predicate_filter = lambda tag: isinstance(tag, str) and predicate(tag)
    elif predicate is not None:
        raise Exception(f"Unknown predicate type {type(predicate)} passed to filter_boto_description.")
    if isinstance(description.get(name), list):
        for item in description[name]:
            if isinstance(item.get("Tags"), list):
                tags = [tag for tag in item["Tags"] if tag.get("Key") == "Name"]
                if tags:
                    tag = tags[0].get("Value")
                    if predicate is None or predicate_filter(tag):
                        item = create_record(tag, item) if create_record else item
                        if item:
                            results.append(item)
                elif predicate is None:
                    item = create_record(None, item) if create_record else item
                    if item:
                        results.append(item)
            elif predicate is None:
                item = create_record(None, item) if create_record else item
                if item:
                    results.append(item)
    return sorted(results, key=lambda value: value["name"]) if create_record else results


@memoize
def aws_get_vpcs(predicate: Optional[Union[str, re.Pattern, Callable]] = None, raw: bool = False) -> list:
    """
    Returns the list of AWS VPCs which have tags names matching the given tag predicate.
    This predicate may be (1) a string in which case it is used to match (case-sensitive) the
    tag name exactly, or as a prefix if it ends with an asterisk; or (2) a regular expression
    against which the tag name will be matched, or (3) a function which will be called with
    each tag name and which should return True iff the tag name should be considered a match.
    If no matches then returns empty list. Raises exception on error.
    """
    def create_record(tag: str, item: dict) -> dict:
        #
        # Example record from boto3.describe_vpcs:
        # [
        #   {
        #     "CidrBlock": "10.0.0.0/16",
        #     "DhcpOptionsId": "dopt-2b55834e",
        #     "State": "available",
        #     "VpcId": "vpc-066421dc99161d0ea",
        #     "OwnerId": "643366669028",
        #     "InstanceTenancy": "default",
        #     "CidrBlockAssociationSet": [
        #       {
        #         "AssociationId": "vpc-cidr-assoc-05e5b76d30ba02747",
        #         "CidrBlock": "10.0.0.0/16",
        #         "CidrBlockState": {
        #           "State": "associated"
        #         }
        #       }
        #     ],
        #     "IsDefault": false,
        #     "Tags": [
        #       {
        #         "Key": "Name",
        #         "Value": "C4NetworkMainVPC"
        #       },
        #       {
        #         "Key": "aws:cloudformation:logical-id",
        #         "Value": "C4NetworkMainVPC"
        #       },
        #       {
        #         "Key": "project",
        #         "Value": "cgap"
        #       },
        #       {
        #         "Key": "owner",
        #         "Value": "project"
        #       },
        #       {
        #         "Key": "aws:cloudformation:stack-name",
        #         "Value": "c4-network-main-stack"
        #       },
        #       {
        #         "Key": "env",
        #         "Value": "prod"
        #       },
        #       {
        #         "Key": "aws:cloudformation:stack-id",
        #         "Value": "arn:aws:cloudformation:us-east-1:643366669028:stack/c4-network-main-stack/731ba770-31d5-11ec-b3df-0acc80a06d55"
        #       }
        #     ]
        #   }
        #
        if item.get("Tags"):
            stack_name_tags = [tag for tag in item["Tags"] if tag.get("Key") == "aws:cloudformation:stack-name"]
            stack_name = stack_name_tags[0].get("Value") if stack_name_tags else None
        else:
            stack_name = None
        return {
            "name": tag or item.get("VpcId"),
            "id": item.get("VpcId"),
            "cidr": item.get("CidrBlock"),
            "owner": item.get("OwnerId"),
            "stack": stack_name,
            "status": item.get("State")
        }
    ec2 = boto3.client('ec2')
    vpcs = ec2.describe_vpcs()
    vpcs = _filter_boto_description_list(vpcs, "Vpcs", predicate, create_record if not raw else None)
    return vpcs


@memoize
def aws_get_subnets(predicate: Optional[Union[str, re.Pattern, Callable]] = None, raw: bool = False) -> list:
    """
    Returns the list of AWS Subnets which have tags names matching the given tag predicate.
    This predicate may be (1) a string in which case it is used to match (case-sensitive) the
    tag name exactly, or as a prefix if it ends with an asterisk; or (2) a regular expression
    against which the tag name will be matched, or (3) a function which will be called with
    each tag name and which should return True iff the tag name should be considered a match.
    If no matches then returns empty list. Raises exception on error.
    """
    def create_record(tag: str, item: dict) -> dict:
        #
        # Example record from boto3.describe_subnets:
        # {
        #   "AvailabilityZone": "us-east-1a",
        #   "AvailabilityZoneId": "use1-az1",
        #   "AvailableIpAddressCount": 16317,
        #   "CidrBlock": "10.0.0.0/18",
        #   "DefaultForAz": false,
        #   "MapPublicIpOnLaunch": false,
        #   "MapCustomerOwnedIpOnLaunch": false,
        #   "State": "available",
        #   "SubnetId": "subnet-0289fd123573a5d6f",
        #   "VpcId": "vpc-066421dc99161d0ea",
        #   "OwnerId": "643366669028",
        #   "AssignIpv6AddressOnCreation": false,
        #   "Ipv6CidrBlockAssociationSet": [],
        #   "Tags": [
        #     {
        #       "Key": "env",
        #       "Value": "prod"
        #     },
        #     {
        #       "Key": "aws:cloudformation:stack-id",
        #       "Value": "arn:aws:cloudformation:us-east-1:643366669028:stack/c4-network-main-stack/731ba770-31d5-11ec-b3df-0acc80a06d55"
        #     },
        #     {
        #       "Key": "owner",
        #       "Value": "project"
        #     },
        #     {
        #       "Key": "project",
        #       "Value": "cgap"
        #     },
        #     {
        #       "Key": "aws:cloudformation:stack-name",
        #       "Value": "c4-network-main-stack"
        #     },
        #     {
        #       "Key": "Name",
        #       "Value": "C4NetworkMainPrivateSubnetA"
        #     },
        #     {
        #       "Key": "aws:cloudformation:logical-id",
        #       "Value": "C4NetworkMainPrivateSubnetA"
        #     }
        #   ],
        #   "SubnetArn": "arn:aws:ec2:us-east-1:643366669028:subnet/subnet-0289fd123573a5d6f",
        #   "EnableDns64": false,
        #   "Ipv6Native": false,
        #   "PrivateDnsNameOptionsOnLaunch": {
        #     "HostnameType": "ip-name",
        #     "EnableResourceNameDnsARecord": false,
        #     "EnableResourceNameDnsAAAARecord": false
        #   }
        # }
        #
        id = item.get("SubnetId")
        name = tag or id
        if item.get("Tags"):
            stack_name_tags = [tag for tag in item["Tags"] if tag.get("Key") == "aws:cloudformation:stack-name"]
            stack_name = stack_name_tags[0].get("Value") if stack_name_tags else None
        else:
            stack_name = None
        return {
            "name": name,
            "id": id,
            "type": "private" if "private" in name.lower() else "public",
            "zone": item.get("AvailabilityZone"),
            "cidr": item.get("CidrBlock"),
            "stack": stack_name,
            "owner": item.get("OwnerId"),
            "subnet": item.get("SubnetId"),
            "subnet_arn": item.get("SubnetArn"),
            "vpc": item.get("VpcId"),
            "status": item.get("State")
        }
    ec2 = boto3.client('ec2')
    subnets = ec2.describe_subnets()
    subnets = _filter_boto_description_list(subnets, "Subnets", predicate, create_record if not raw else None)
    return subnets


@memoize
def aws_get_security_groups(predicate: Optional[Union[str, re.Pattern, Callable]] = None, raw: bool = False) -> list:
    """
    Returns the list of AWS Security Groups which have tags names matching the given tag predicate.
    This predicate may be (1) a string in which case it is used to match (case-sensitive) the
    tag name exactly, or as a prefix if it ends with an asterisk; or (2) a regular expression
    against which the tag name will be matched, or (3) a function which will be called with
    each tag name and which should return True iff the tag name should be considered a match.
    If no matches then returns empty list. Raises exception on error.
    """
    def create_record(tag: str, item: dict) -> dict:
        #
        # Example record from boto3.describe_subnets:
        # {
        #   "Description": "allows database access on a port range",
        #   "GroupName": "C4NetworkMainDBSecurityGroup",
        #   "IpPermissions": [
        #     {
        #       "FromPort": 5400,
        #       "IpProtocol": "tcp",
        #       "IpRanges": [
        #         {
        #           "CidrIp": "0.0.0.0/0",
        #           "Description": "allows database access on tcp ports 54xx"
        #         }
        #       ],
        #       "Ipv6Ranges": [],
        #       "PrefixListIds": [],
        #       "ToPort": 5499,
        #       "UserIdGroupPairs": []
        #     }
        #   ],
        #   "OwnerId": "643366669028",
        #   "GroupId": "sg-00a1706c6a3fa86af",
        #   "IpPermissionsEgress": [
        #     {
        #       "FromPort": 5400,
        #       "IpProtocol": "tcp",
        #       "IpRanges": [
        #         {
        #           "CidrIp": "0.0.0.0/0",
        #           "Description": "allows outbound traffic to tcp 54xx"
        #         }
        #       ],
        #       "Ipv6Ranges": [],
        #       "PrefixListIds": [],
        #       "ToPort": 5499,
        #       "UserIdGroupPairs": []
        #     }
        #   ],
        #   "Tags": [
        #     {
        #       "Key": "env",
        #       "Value": "prod"
        #     },
        #     {
        #       "Key": "aws:cloudformation:stack-id",
        #       "Value": "arn:aws:cloudformation:us-east-1:643366669028:stack/c4-network-main-stack/731ba770-31d5-11ec-b3df-0acc80a06d55"
        #     },
        #     {
        #       "Key": "owner",
        #       "Value": "project"
        #     },
        #     {
        #       "Key": "project",
        #       "Value": "cgap"
        #     },
        #     {
        #       "Key": "Name",
        #       "Value": "C4NetworkMainDBSecurityGroup"
        #     },
        #     {
        #       "Key": "aws:cloudformation:logical-id",
        #       "Value": "C4NetworkMainDBSecurityGroup"
        #     },
        #     {
        #       "Key": "aws:cloudformation:stack-name",
        #       "Value": "c4-network-main-stack"
        #     }
        #   ],
        #   "VpcId": "vpc-066421dc99161d0ea"
        # }
        #
        name = item.get("GroupName") or tag
        if item.get("Tags"):
            stack_name_tags = [tag for tag in item["Tags"] if tag.get("Key") == "aws:cloudformation:stack-name"]
            stack_name = stack_name_tags[0].get("Value") if stack_name_tags else None
        else:
            stack_name = None
        return {
            **({"name": name} if name == tag else {"name": name, "tag": tag}),
            "id": item.get("GroupId"),
            "description": item.get("Description"),
            "stack": stack_name,
            "owner": item.get("OwnerId"),
            "vpc": item.get("VpcId")
        }
    ec2 = boto3.client('ec2')
    security_groups = ec2.describe_security_groups()
    security_groups = _filter_boto_description_list(security_groups, "SecurityGroups", predicate, create_record if not raw else None)
    return security_groups


@memoize
def aws_get_security_group_rules(security_group_id: str, direction: Optional[str] = None, raw: bool = False) -> list:
    def create_record(item: dict) -> dict:
        #
        # Example record from boto3.describe_security_group_rules:
        # {
        #   "SecurityGroupRuleId": "sgr-05f67771a8807ee27",
        #   "GroupId": "sg-09c7f9e502c5b3b7c",
        #   "GroupOwnerId": "643366669028",
        #   "IsEgress": true,
        #   "IpProtocol": "tcp",
        #   "FromPort": 8005,
        #   "ToPort": 8005,
        #   "CidrIpv4": "0.0.0.0/0",
        #   "Description": "outbound traffic for higlass server",
        #   "Tags": []
        # }
        return {
            "id": item["SecurityGroupRuleId"],
            "security_group": item["GroupId"],
            "protocol": item.get("IpProtocol") if item.get("IpProtocol") != "-1" else "Any",
            "port_from": item.get("FromPort"),
            "port_thru": item.get("ToPort"),
            "egress": item.get("IsEgress"),
            "cidr": item.get("CidrIpv4"),
            "description": item.get("Description"),
            "owner": item.get("GroupOwnerId")
        }
    ec2 = boto3.client('ec2')
    filters = [{"Name": "group-id", "Values": [security_group_id]}]
    security_group_rules = ec2.describe_security_group_rules(Filters=filters)["SecurityGroupRules"]
    if direction == "inbound":
        security_group_rules = [security_group_rule for security_group_rule in security_group_rules if security_group_rule.get("IsEgress") is False]
    elif direction == "outbound":
        security_group_rules = [security_group_rule for security_group_rule in security_group_rules if security_group_rule.get("IsEgress") is True]
    if not raw:
        security_group_rules = [create_record(security_group_rule) for security_group_rule in security_group_rules]
        security_groups_rules = sorted(security_group_rules, key=lambda value: value["id"])
    return security_group_rules


@memoize
def aws_get_network(predicate: Optional[Union[str, re.Pattern, Callable]] = None, raw: bool = False) -> list:
    """
    Returns AWS network info, i.e. WRT VPCs, Subnets, and Security Groups.
    """
    vpcs = aws_get_vpcs(predicate, raw)
    vpcs = copy.deepcopy(vpcs)  # Copy as we're going to modify and it's memoized.
    subnets = aws_get_subnets(predicate, raw)
    sgs = aws_get_security_groups(predicate, raw)
    vpc_property = "vpc" if not raw else "VpcId"
    id_property = "id" if not raw else "VpcId"
    for vpc in vpcs:
        vpc["subnets"] = [subnet for subnet in subnets if subnet[vpc_property] == vpc[id_property]]
        vpc["security_groups"] = [sg for sg in sgs if sg[vpc_property] == vpc[id_property]]
    return vpcs


def aws_network_cache_clear():
    aws_get_vpcs.cache_clear()
    aws_get_subnets.cache_clear()
    aws_get_security_groups.cache_clear()
    aws_get_security_group_rules.cache_clear()
    aws_get_network.cache_clear()
