import boto3
import copy
import re
from typing import Callable, Optional, Union
# TODO: Included here until we get utils PR-236 approved/merged/pushed
# from dcicutils.misc_utils import keys_and_values_to_dict
from .misc_utils import keys_and_values_to_dict
from dcicutils.function_cache_decorator import function_cache
from dcicutils.obfuscation_utils import obfuscate_dict
from .misc_utils import sort_dictionary_by_case_insensitive_keys


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
    If no matches then returns empty list. Raises exception on error. Abbreviated example description:

    { "Vpcs": [
        {
          "ExampleRecord": "Example record",
          "Tags": [
            {
              "Key": "Name",
              "Value": "This is the tag name to match with the given predicate"
            },
          ]
        },
        {
          "AnotherExampleRecord": "Another example record",
          "Tags": [
            {
              "Key": "Name",
              "Value": "This is the tag name to match with the given predicate"
            },
          ]
        },
      ]
    }

    :param description:   Dictionary from output of boto3 describe_vpcs, describe_subnets,
                          or describe_security_groups; object with main list element with name
                          specified by the given name argument; a subset of these elements are
                          returned based on the given predicate.
    :param name:          Property name of the main list element in the given description dictionary
                          containing the relevant items, a subset of which will be returned based on
                          match of item tag name values via the given predicate.
    :param predicate:     Predicate choosing which items in main list to return based on it matching "Value"
                          of tag in "Tags" list, within each item, whose "Key" value is "Name". Case-sensitive
                          string matching tag name value exactly or its prefix if ending in asterisk; or regular
                          expression matching tag name; or function returning True on match of given tag name.
    :param create_record: Optional function taking a matched item (dictionary) and returning
                          a modified version of it.
    :returns:             List of items from given description dictionary as described above.
    :raises Exception:    On any error.
    """
    results = []

    # TODO: Could possibly extend the dcicutils.misc_utils.find_associations function to be able to do some
    # of this work; won't work as-is because we're the Tags Key/Value list we're looking at choose the given
    # list of items is a sub-list of each item.

    if isinstance(predicate, str):
        if predicate.endswith("*"):
            predicate_prefix = predicate[:-1]
            predicate_filter = lambda tag: tag and tag.startswith(predicate_prefix)
        else:
            predicate_filter = lambda tag: tag and tag == predicate
    elif isinstance(predicate, re.Pattern):
        predicate_filter = lambda tag: tag and predicate.match(tag) is not None
    elif isinstance(predicate, Callable):
        predicate_filter = lambda tag: tag and predicate(tag)
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


def _create_tags_dictionary(tags: list) -> dict:
    """
    Transforms the given boto3-style list of tag objects, each containing a "Key" and "Value" property,
    to a simple dictionary of keys/values, sorted (alphabetically ascending by key). For example given this:
    [
      { "Key": "env",
        "Value": "prod"
      },
      { "Key": "aws:cloudformation:stack-name",
        "Value": "c4-network-main-stack"
      }
    ]

    We would return this:
    {
      "env": "prod"
      "aws:cloudformation:stack-name": "c4-network-main-stack"
    }

    :param tags: Dictionary of tags as described above.
    :returns: List from given dictionary of tags as described above.
    """
    return sort_dictionary_by_case_insensitive_keys(obfuscate_dict(keys_and_values_to_dict(tags)))


@function_cache
def aws_get_vpcs(predicate: Optional[Union[str, re.Pattern, Callable]] = None, raw: bool = False) -> list:
    """
    Returns the list of AWS VPCs which have tags names matching the given tag predicate.
    This predicate may be (1) a string in which case it is used to match (case-sensitive) the
    tag name exactly, or as a prefix if it ends with an asterisk; or (2) a regular expression
    against which the tag name will be matched, or (3) a function which will be called with
    each tag name and which should return True iff the tag name should be considered a match.
    If no matches then returns empty list. Raises exception on error.

    :param predicate: Predicate choosing which items in main array to return based on it matching "Value"
                      of tag in "Tags" array, within each item, whose "Key" value is "Name". Case-sensitive
                      string matching tag name value exactly or its prefix if ending in asterisk; or regular
                      expression matching tag name; or function returning True on match of given tag name.
    :param raw: Returns raw (matched) objects iff True otherwise returns our own canonical form.
    :returns: List of matching (based on predicate) AWS VPC objects.
    :raises Exception: On any error.
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
        #     ]
        #   }
        #
        if item.get("Tags"):
            stack_name_tags = [tag for tag in item["Tags"] if tag.get("Key") == "aws:cloudformation:stack-name"]
            stack_name = stack_name_tags[0].get("Value") if stack_name_tags else None
            tags = _create_tags_dictionary(item["Tags"])
        else:
            stack_name = None
            tags = None
        return {
            "name": tag or item.get("VpcId"),
            "id": item.get("VpcId"),
            "cidr": item.get("CidrBlock"),
            "owner": item.get("OwnerId"),
            "stack": stack_name,
            "status": item.get("State"),
            "tags": tags
        }
    ec2 = boto3.client("ec2")
    vpcs = ec2.describe_vpcs()
    vpcs = _filter_boto_description_list(vpcs, "Vpcs", predicate, create_record if not raw else None)
    return vpcs


@function_cache
def aws_get_subnets(predicate: Optional[Union[str, re.Pattern, Callable]] = None,
                    vpc_id: Optional[str] = None, raw: bool = False) -> list:
    """
    Returns the list of AWS Subnets which have tags names matching the given tag predicate.
    This predicate may be (1) a string in which case it is used to match (case-sensitive) the
    tag name exactly, or as a prefix if it ends with an asterisk; or (2) a regular expression
    against which the tag name will be matched, or (3) a function which will be called with
    each tag name and which should return True iff the tag name should be considered a match.
    If no matches then returns empty list. Raises exception on error.

    :param predicate: Predicate choosing which items in main array to return based on it matching "Value"
                      of tag in "Tags" array, within each item, whose "Key" value is "Name". Case-sensitive
                      string matching tag name value exactly or its prefix if ending in asterisk; or regular
                      expression matching tag name; or function returning True on match of given tag name.
    :param vpc_id: Optional VPC ID to limit returned Subnets to those associated with this VPC ID.
    :param raw: Returns raw (matched) objects iff True otherwise returns our own canonical form.
    :returns: List of matching (based on predicate) AWS Subnet objects.
    :raises Exception: On any error.
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
        subnet_id = item.get("SubnetId")
        name = tag or subnet_id
        if item.get("Tags"):
            stack_name_tags = [tag for tag in item["Tags"] if tag.get("Key") == "aws:cloudformation:stack-name"]
            stack_name = stack_name_tags[0].get("Value") if stack_name_tags else None
            tags = _create_tags_dictionary(item["Tags"])
        else:
            stack_name = None
            tags = None
        return {
            "name": name,
            "id": subnet_id,
            "type": "private" if "private" in name.lower() else "public",
            "zone": item.get("AvailabilityZone"),
            "cidr": item.get("CidrBlock"),
            "stack": stack_name,
            "owner": item.get("OwnerId"),
            "subnet": item.get("SubnetId"),
            "subnet_arn": item.get("SubnetArn"),
            "vpc": item.get("VpcId"),
            "status": item.get("State"),
            "tags": tags
        }
    ec2 = boto3.client("ec2")
    subnets = ec2.describe_subnets()
    subnets = _filter_boto_description_list(subnets, "Subnets", predicate, create_record if not raw else None)
    if vpc_id:
        vpc_property = "vpc" if not raw else "VpcId"
        subnets = [subnet for subnet in subnets if subnet.get(vpc_property) == vpc_id]
    return subnets


@function_cache
def aws_get_security_groups(predicate: Optional[Union[str, re.Pattern, Callable]] = None,
                            vpc_id: Optional[str] = None, raw: bool = False) -> list:
    """
    Returns the list of AWS Security Groups which have tags names matching the given tag predicate.
    This predicate may be (1) a string in which case it is used to match (case-sensitive) the
    tag name exactly, or as a prefix if it ends with an asterisk; or (2) a regular expression
    against which the tag name will be matched, or (3) a function which will be called with
    each tag name and which should return True iff the tag name should be considered a match.
    If no matches then returns empty list. Raises exception on error.

    :param predicate: Predicate choosing which items in main array to return based on it matching "Value"
                      of tag in "Tags" array, within each item, whose "Key" value is "Name". Case-sensitive
                      string matching tag name value exactly or its prefix if ending in asterisk; or regular
                      expression matching tag name; or function returning True on match of given tag name.
    :param vpc_id: Optional VPC ID to limit returned Securty Groups to those associated with this VPC ID.
    :param raw: Returns raw (matched) objects iff True otherwise returns our own canonical form.
    :returns: List of matching (based on predicate) AWS Security Group objects.
    :raises Exception: On any error.
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
            tags = _create_tags_dictionary(item["Tags"])
        else:
            stack_name = None
            tags = None
        return {
            **({"name": name} if name == tag else {"name": name, "tag": tag}),
            "id": item.get("GroupId"),
            "description": item.get("Description"),
            "stack": stack_name,
            "owner": item.get("OwnerId"),
            "vpc": item.get("VpcId"),
            "tags": tags
        }
    ec2 = boto3.client("ec2")
    security_groups = ec2.describe_security_groups()
    security_groups = _filter_boto_description_list(security_groups, "SecurityGroups", predicate,
                                                    create_record if not raw else None)
    if vpc_id:
        vpc_property = "vpc" if not raw else "VpcId"
        security_groups = [security_group for security_group in security_groups
                           if security_group.get(vpc_property) == vpc_id]
    return security_groups


@function_cache
def aws_get_security_group_rules(security_group_id: str, direction: Optional[str] = None, raw: bool = False) -> list:
    """
    Returns list of AWS Security Group Rules for the given Security Group ID in our own canonical form.

    :param security_group_id: AWS Security Group ID of Rules to return,
    :param direction: If "inbound" or "outbound" then returns only inbound/outbound rules; otherwise all.
    :param raw: Returns raw objects iff True otherwise returns our own canonical form.
    :returns: List of Security Group Rules as described above.
    """
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
    ec2 = boto3.client("ec2")
    filters = [{"Name": "group-id", "Values": [security_group_id]}]
    security_group_rules = ec2.describe_security_group_rules(Filters=filters)["SecurityGroupRules"]
    if direction == "inbound":
        security_group_rules = [security_group_rule for security_group_rule in security_group_rules
                                if security_group_rule.get("IsEgress") is False]
    elif direction == "outbound":
        security_group_rules = [security_group_rule for security_group_rule in security_group_rules
                                if security_group_rule.get("IsEgress") is True]
    if not raw:
        security_group_rules = [create_record(security_group_rule) for security_group_rule in security_group_rules]
    return security_group_rules


@function_cache
def aws_get_network(predicate: Optional[Union[str, re.Pattern, Callable]] = None, raw: bool = False) -> list:
    """
    Returns AWS network info, i.e. WRT VPCs, Subnets, and Security Groups, whose tags match the given predicate

    :param predicate: Predicate choosing which items in to return based on it matching "Value" of tag in "Tags" array,
                      within each item, whose "Key" value is "Name". Case-sensitive string matching tag name value
                      exactly or its prefix if ending in asterisk; or regular expression matching tag name; or function
                      returning True on match of given tag name.
    :param raw: Returns raw (matched) objects iff True otherwise returns our own canonical form.
    :returns: List of matching (based on predicate) AWS VPC, Subnet, and Security Group objects.
    :raises Exception: On any error.
    """
    vpcs = aws_get_vpcs(predicate, raw)
    vpcs = copy.deepcopy(vpcs)  # Copy because we're going to modify and it's cached.
    subnets = aws_get_subnets(predicate, None, raw)
    sgs = aws_get_security_groups(predicate, None, raw)
    vpc_property = "vpc" if not raw else "VpcId"
    id_property = "id" if not raw else "VpcId"
    for vpc in vpcs:
        vpc["subnets"] = [subnet for subnet in subnets if subnet[vpc_property] == vpc[id_property]]
        vpc["security_groups"] = [sg for sg in sgs if sg[vpc_property] == vpc[id_property]]
    return vpcs
