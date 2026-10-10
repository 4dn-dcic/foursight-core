"""Resolve launch networking from deployed ECS services, never from Lambda placement."""

import boto3
import logging
from botocore.exceptions import BotoCoreError, ClientError
from .aws_network import aws_get_security_groups, aws_get_subnets, aws_get_vpcs
from .misc_utils import find_common_prefix


logger = logging.getLogger(__name__)


def get_cluster_services(cluster_arn):
    ecs = boto3.client("ecs")
    arns = [arn for page in ecs.get_paginator("list_services").paginate(cluster=cluster_arn)
            for arn in page["serviceArns"]]
    services = []
    for offset in range(0, len(arns), 10):
        response = ecs.describe_services(cluster=cluster_arn, services=arns[offset:offset + 10])
        if response.get("failures"):
            raise ValueError("service_discovery_incomplete")
        batch = response.get("services", [])
        if len(batch) != len(arns[offset:offset + 10]):
            raise ValueError("service_discovery_incomplete")
        services.extend(service for service in batch if service.get("status") == "ACTIVE")
    return services


def _resource(item):
    return {"id": item["id"], "name": item.get("name")}


def _security_group(item):
    return {**_resource(item), "stack": item.get("stack")}


def _service_network(services, task_definition_arn):
    # Task revisions share a network. Standalone deploy tasks have no service;
    # they may use the cluster network only when every active service agrees.
    family = task_definition_arn.rsplit(":", 1)[0]
    matching = [service for service in services
                if (service.get("taskDefinition") or "").rsplit(":", 1)[0] == family]
    configurations = set()
    for service in matching or services:
        config = service.get("networkConfiguration", {}).get("awsvpcConfiguration", {})
        subnets = config.get("subnets") or []
        groups = config.get("securityGroups") or []
        if not subnets or not groups:
            raise ValueError("service_network_missing")
        configurations.add((tuple(sorted(set(subnets))), tuple(sorted(set(groups)))))
    if len(configurations) != 1:
        raise ValueError("service_network_ambiguous")
    subnet_ids, group_ids = configurations.pop()
    # The existing UI/run API carries one security group. Do not drop extras.
    if len(group_ids) != 1:
        raise ValueError("multiple_service_security_groups")
    subnets = [subnet for subnet in aws_get_subnets() if subnet["id"] in subnet_ids]
    groups = [group for group in aws_get_security_groups() if group["id"] in group_ids]
    if {subnet["id"] for subnet in subnets} != set(subnet_ids) or len(groups) != 1:
        raise ValueError("service_network_resources_missing")
    vpc_ids = {item.get("vpc") for item in subnets + groups}
    if len(vpc_ids) != 1 or None in vpc_ids:
        raise ValueError("service_network_cross_vpc")
    vpcs = [vpc for vpc in aws_get_vpcs() if vpc["id"] in vpc_ids]
    if len(vpcs) != 1:
        raise ValueError("service_vpc_missing")
    return {"vpc": _resource(vpcs[0]), "security_group": _security_group(groups[0]),
            "subnets": [_resource(subnet) for subnet in subnets]}


def _single_vpc_network(envs, env, task_definition_arn):
    # Compatibility for accounts without deployed services (e.g. first deploy).
    # Retain the standard container-group convention only within a sole VPC.
    vpcs = aws_get_vpcs()
    if len(vpcs) != 1:
        raise ValueError("no_services_single_vpc_required")
    vpc = vpcs[0]
    groups = []
    for group in aws_get_security_groups(vpc_id=vpc["id"]):
        if group.get("vpc") != vpc["id"] or "container" not in (group.get("name") or "").lower():
            continue
        prefix = find_common_prefix([task_definition_arn, group.get("name") or "", group.get("stack") or ""])
        if ((group.get("stack") and prefix == group["stack"]) or
                envs._env_contained_within(env, group.get("name") or "")):
            groups.append(group)
    if len(groups) != 1:
        raise ValueError("single_vpc_security_group_missing_or_ambiguous")
    subnets = [subnet for subnet in aws_get_subnets(vpc_id=vpc["id"])
               if subnet.get("vpc") == vpc["id"] and subnet.get("type") == "private"]
    preferred = [subnet for subnet in subnets if "main" in (subnet.get("name") or "").lower()]
    preferred = preferred or [subnet for subnet in subnets
                              if envs._env_contained_within(env, subnet.get("name") or "")]
    subnets = preferred or subnets
    if not subnets:
        raise ValueError("single_vpc_private_subnets_missing")
    return {"vpc": _resource(vpc), "security_group": _security_group(groups[0]),
            "subnets": [_resource(subnet) for subnet in subnets]}


def get_task_network(envs, env, task_definition_arn, cluster_arn, service_cache):
    """Return the existing network fields, or a stable additive network_error code.

    Missing/ambiguous clusters, unreadable services, conflicting configurations,
    and invalid resource membership fail closed. Cache only for this API request.
    """
    try:
        if not env or not cluster_arn:
            raise ValueError("task_cluster_missing_or_ambiguous")
        if cluster_arn not in service_cache:
            try:
                service_cache[cluster_arn] = get_cluster_services(cluster_arn)
            except (ClientError, BotoCoreError, ValueError) as error:
                service_cache[cluster_arn] = error
        services = service_cache[cluster_arn]
        if isinstance(services, Exception):
            raise services
        if services:
            return _service_network(services, task_definition_arn)
        return _single_vpc_network(envs, env, task_definition_arn)
    except ClientError as error:
        code = "network_aws_error:" + error.response.get("Error", {}).get("Code", "Unknown")
    except BotoCoreError:
        code = "network_aws_unavailable"
    except ValueError as error:
        code = str(error)
    # Do not log AWS exception text: it can contain account/resource identifiers.
    logger.warning("ECS task network unresolved: %s", code)
    return {"network_error": code}
