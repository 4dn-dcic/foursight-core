import boto3
import copy
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
                        results.append(create_record(tag, item) if create_record else item)
                elif predicate is None:
                    results.append(create_record(None, item) if create_record else item)
            elif predicate is None:
                results.append(create_record(None, item) if create_record else item)
    return results


@memoize
def get_aws_vpcs(predicate: Optional[Union[str, re.Pattern, Callable]] = None) -> list:
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
        return {
            "name": tag,
            "tag": tag,
            "id": item.get("VpcId"),
            "cidr": item.get("CidrBlock"),
            "owner": item.get("OwnerId"),
            "state": item.get("State")
        }
    ec2 = boto3.client('ec2')
    return _filter_boto_description_list(ec2.describe_vpcs(), "Vpcs", predicate, create_record)


@memoize
def get_aws_subnets(predicate: Optional[Union[str, re.Pattern, Callable]] = None) -> list:
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
        return {
            "tag": tag,
            "id": item.get("SubnetId"),
            "zone": item.get("AvailabilityZone"),
            "cidr": item.get("CidrBlock"),
            "owner": item.get("OwnerId"),
            "subnet": item.get("SubnetId"),
            "subnet_arn": item.get("SubnetArn"),
            "vpc": item.get("VpcId"),
            "state": item.get("State")
        }
    ec2 = boto3.client('ec2')
    return _filter_boto_description_list(ec2.describe_subnets(), "Subnets", predicate, create_record)


@memoize
def get_aws_security_groups(predicate: Optional[Union[str, re.Pattern, Callable]] = None) -> list:
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
        return {
            "name": item.get("GroupName"),
            "tag": tag,
            "id": item.get("GroupId"),
            "description": item.get("Description"),
            "vpc": item.get("VpcId")
        }
    ec2 = boto3.client('ec2')
    return _filter_boto_description_list(ec2.describe_security_groups(), "SecurityGroups", predicate, create_record)


@memoize
def get_aws_network(predicate: Optional[Union[str, re.Pattern, Callable]] = None) -> list:
    """
    Returns AWS network info, i.e. WRT VPCs, Subnets, and Security Groups.
    """
    vpcs = copy.deepcopy(get_aws_vpcs(predicate))
    subnets = get_aws_subnets(predicate)
    security_groups = get_aws_security_groups(predicate)
    for vpc in vpcs:
        vpc["subnets"] = [subnet for subnet in subnets if subnet["vpc"] == vpc["id"]]
        vpc["security_groups"] = [security_group for security_group in security_groups if security_group["vpc"] == vpc["id"]]
    return vpcs
