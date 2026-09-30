from unittest import mock
import copy

import pytest
from botocore.exceptions import ClientError, EndpointConnectionError
from foursight_core.react.api import aws_ecs_tasks as tasks
from foursight_core.react.api.envs import Envs
from foursight_core.react.api import aws_ecs_task_network as discovery


ENV = {key: "smaht-dev-srce" for key in ["name", "full_name", "short_name", "public_name", "foursight_name"]}
CLUSTER = "arn:aws:ecs:us-east-1:000000000000:cluster/smaht-dev-srce"
TASK = "arn:aws:ecs:us-east-1:000000000000:task-definition/smaht-dev-srce-Deployment:1"


@pytest.fixture(scope="session", autouse=True)
def setup():
    # Override conftest's live SQS initialization for these offline API tests.
    pass


@pytest.fixture
def network(monkeypatch):
    # IT-provided Application/Database/Compute VPCs: no Name contains "main".
    vpcs = [{"id": f"vpc-{name}", "name": name} for name in ["Application", "Database", "Compute"]]
    subnets = [{"id": f"subnet-{name}", "name": f"{name}Private", "vpc": f"vpc-{name}", "type": "private"}
               for name in ["Application", "Database", "Compute"]]
    groups = [{"id": f"sg-{name}", "name": f"{name}SecurityGroup", "vpc": f"vpc-{name}", "stack": None}
              for name in ["Application", "Database", "Compute"]]
    service = {"status": "ACTIVE", "taskDefinition": TASK.replace("Deployment", "Portal"),
               "networkConfiguration": {"awsvpcConfiguration": {
                   "subnets": ["subnet-Application"], "securityGroups": ["sg-Application"]}}}
    ecs = mock.Mock()
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": ["service-portal"]}]
    ecs.describe_services.return_value = {"services": [service], "failures": []}
    monkeypatch.setattr(tasks.boto3, "client", lambda name: ecs if name == "ecs" else pytest.fail(name))
    monkeypatch.setattr(tasks, "_get_task_definition_arns", lambda: [TASK])
    monkeypatch.setattr(tasks, "_get_cluster_arns", lambda: [CLUSTER])
    monkeypatch.setattr(discovery, "aws_get_vpcs", lambda: vpcs)
    monkeypatch.setattr(discovery, "aws_get_subnets", lambda vpc_id=None: [
        s for s in subnets if not vpc_id or s["vpc"] == vpc_id])
    monkeypatch.setattr(discovery, "aws_get_security_groups", lambda vpc_id=None: [
        g for g in groups if not vpc_id or g["vpc"] == vpc_id])
    return vpcs, subnets, groups, ecs, service


def response():
    return tasks.get_aws_ecs_tasks_for_running(Envs([ENV.copy()]), task_definition_type="deploy")[0]


def test_srce_tasks_for_running_uses_deployed_ecs_network(network):
    result = response()
    assert result["vpc"] == {"id": "vpc-Application", "name": "Application"}
    assert result["security_group"]["id"] == "sg-Application"
    assert result["subnets"] == [{"id": "subnet-Application", "name": "ApplicationPrivate"}]


def test_standard_single_vpc_fallback(network):
    vpcs, subnets, groups, ecs, _ = network
    vpcs[:] = vpcs[:1]
    subnets[:] = subnets[:1]
    groups[:] = groups[:1]
    groups[0].update(name="smaht-dev-srce-ContainerSecurityGroup", stack="smaht-dev-srce")
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": []}]
    result = response()
    assert result["vpc"]["id"] == vpcs[0]["id"]
    assert result["security_group"]["id"] == groups[0]["id"]
    assert result["subnets"] == [{"id": subnets[0]["id"], "name": subnets[0]["name"]}]


def assert_unresolved(code):
    result = response()
    assert result["network_error"] == code
    assert not {"vpc", "security_group", "subnets"}.intersection(result)


@pytest.mark.parametrize("vpc_count", [0, 2, 3])
def test_no_services_requires_single_vpc(network, vpc_count):
    vpcs, _, _, ecs, _ = network
    vpcs[:] = vpcs[:vpc_count]
    if vpcs:
        vpcs[0]["name"] = "MainApplication"  # A name cannot rescue ambiguous placement.
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": []}]
    assert_unresolved("no_services_single_vpc_required")


@pytest.mark.parametrize("operation", ["list", "describe", "ec2"])
def test_permission_denied_fails_closed(network, monkeypatch, operation):
    _, _, _, ecs, _ = network
    error = ClientError({"Error": {"Code": "AccessDeniedException", "Message": "private-example"}}, "Read")
    if operation == "list":
        ecs.get_paginator.return_value.paginate.side_effect = error
    elif operation == "describe":
        ecs.describe_services.side_effect = error
    else:
        monkeypatch.setattr(discovery, "aws_get_subnets", mock.Mock(side_effect=error))
    with mock.patch.object(discovery.logger, "warning") as warning:
        assert_unresolved("network_aws_error:AccessDeniedException")
    warning.assert_called_once_with("ECS task network unresolved: %s", "network_aws_error:AccessDeniedException")


def test_aws_unavailable(network):
    network[3].get_paginator.return_value.paginate.side_effect = EndpointConnectionError(endpoint_url="private")
    assert_unresolved("network_aws_unavailable")


@pytest.mark.parametrize("problem,code", [
    ("missing_subnets", "service_network_missing"),
    ("missing_groups", "service_network_missing"),
    ("multiple_groups", "multiple_service_security_groups"),
    ("missing_subnet_resource", "service_network_resources_missing"),
    ("missing_group_resource", "service_network_resources_missing"),
    ("missing_vpc", "service_vpc_missing"),
    ("cross_vpc_group", "service_network_cross_vpc"),
    ("cross_vpc_subnet", "service_network_cross_vpc"),
])
def test_invalid_service_network_has_no_fallback(network, problem, code):
    vpcs, subnets, groups, _, service = network
    config = service["networkConfiguration"]["awsvpcConfiguration"]
    if problem == "missing_subnets":
        config["subnets"] = []
    elif problem == "missing_groups":
        config["securityGroups"] = []
    elif problem == "multiple_groups":
        config["securityGroups"].append("sg-Database")
    elif problem == "missing_subnet_resource":
        subnets.pop(0)
    elif problem == "missing_group_resource":
        groups.pop(0)
    elif problem == "missing_vpc":
        vpcs.pop(0)
    elif problem == "cross_vpc_group":
        groups[0]["vpc"] = "vpc-Database"
    elif problem == "cross_vpc_subnet":
        config["subnets"].append("subnet-Database")
    assert_unresolved(code)


def test_conflicting_service_networks_are_ambiguous(network):
    _, _, _, ecs, service = network
    other = copy.deepcopy(service)
    other["networkConfiguration"]["awsvpcConfiguration"]["subnets"] = ["subnet-Database"]
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": ["one", "two"]}]
    ecs.describe_services.return_value["services"].append(other)
    assert_unresolved("service_network_ambiguous")


def test_service_family_network_precedes_cluster_consensus(network):
    _, _, _, ecs, service = network
    other = copy.deepcopy(service)
    service["taskDefinition"] = TASK.rsplit(":", 1)[0] + ":42"
    other["networkConfiguration"]["awsvpcConfiguration"]["subnets"] = ["subnet-Database"]
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": ["one", "two"]}]
    ecs.describe_services.return_value["services"].append(other)
    assert response()["vpc"]["id"] == "vpc-Application"


def test_multiple_services_same_network_is_unambiguous(network):
    _, _, _, ecs, service = network
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": ["one", "two"]}]
    ecs.describe_services.return_value["services"].append(copy.deepcopy(service))
    assert response()["security_group"]["id"] == "sg-Application"


@pytest.mark.parametrize("failure", ["reported", "omitted"])
def test_incomplete_service_discovery(network, failure):
    ecs = network[3]
    if failure == "reported":
        ecs.describe_services.return_value["failures"] = [{"reason": "MISSING"}]
    else:
        ecs.describe_services.return_value["services"] = []
    assert_unresolved("service_discovery_incomplete")


@pytest.mark.parametrize("clusters", [[], [CLUSTER, CLUSTER + "-other"]])
def test_cluster_missing_or_ambiguous(network, monkeypatch, clusters):
    monkeypatch.setattr(tasks, "_get_cluster_arns", lambda: clusters)
    assert_unresolved("task_cluster_missing_or_ambiguous")
    network[3].get_paginator.assert_not_called()


@pytest.mark.parametrize("group_count", [0, 2])
def test_single_vpc_fallback_rejects_missing_or_ambiguous_groups(network, group_count):
    vpcs, _, groups, ecs, _ = network
    vpcs[:] = vpcs[:1]
    groups[:] = [dict(groups[0], id=f"sg-{i}", name="smaht-dev-srce-ContainerSecurityGroup")
                 for i in range(group_count)]
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": []}]
    assert_unresolved("single_vpc_security_group_missing_or_ambiguous")


def test_single_vpc_fallback_rejects_cross_vpc_and_missing_subnets(network):
    vpcs, subnets, groups, ecs, _ = network
    vpcs[:] = vpcs[:1]
    groups[0]["name"] = "smaht-dev-srce-ContainerSecurityGroup"
    subnets.pop(0)
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": []}]
    assert_unresolved("single_vpc_private_subnets_missing")


def test_service_discovery_paginates_batches_and_reuses_per_request(network, monkeypatch):
    _, _, _, ecs, service = network
    ecs.get_paginator.return_value.paginate.return_value = [
        {"serviceArns": [f"service-{i}" for i in range(10)]}, {"serviceArns": ["service-10"]}]
    ecs.describe_services.side_effect = [{"services": [service] * 10}, {"services": [service]}]
    monkeypatch.setattr(tasks, "_get_task_definition_arns", lambda: [TASK, TASK.replace("Deployment", "Indexer")])
    results = tasks.get_aws_ecs_tasks_for_running(Envs([ENV.copy()]))
    assert len(results) == 2
    assert all(result["vpc"]["id"] == "vpc-Application" for result in results)
    assert ecs.describe_services.call_count == 2
    assert ecs.get_paginator.return_value.paginate.call_count == 1


def test_srce_endpoint_returns_deployed_network(network):
    from foursight_core.react.api import react_routes, react_route_decorator
    app = mock.Mock()
    app.current_request.to_dict.return_value = {"method": "GET"}
    app.core._envs = Envs([ENV.copy()])
    app.core.react_authorize.return_value = {"authenticated": True, "authorized": True}
    with mock.patch.object(react_routes, "app", app), mock.patch.object(react_route_decorator, "app", app):
        result = react_routes.ReactRoutes.reactapi_route_aws_ecs_tasks_for_runing(task_name="deploy")
    assert isinstance(result, list)
    assert result[0]["vpc"]["id"] == "vpc-Application"
    assert result[0]["security_group"]["id"] == "sg-Application"
    assert result[0]["subnets"] == [{"id": "subnet-Application", "name": "ApplicationPrivate"}]


def test_service_authority_overrides_names(network):
    vpcs, subnets, groups, _, _ = network
    vpcs[1]["name"] = "MainApplication"
    groups[1]["name"] = "smaht-dev-srce-ContainerSecurityGroup"
    groups[1]["stack"] = "smaht-dev-srce"
    subnets[1]["name"] = "MainPrivate"
    subnets[0].update(name="untagged", type="public")
    groups[0]["name"] = "untagged"
    result = response()
    assert result["vpc"]["id"] == "vpc-Application"
    assert result["security_group"]["id"] == "sg-Application"
    assert result["subnets"] == [{"id": "subnet-Application", "name": "untagged"}]


def test_standard_single_vpc_uses_service_network(network):
    network[0][:] = network[0][:1]
    assert response()["vpc"]["id"] == "vpc-Application"


def test_single_vpc_denied_service_read_does_not_fallback(network):
    vpcs, _, groups, ecs, _ = network
    vpcs[:] = vpcs[:1]
    groups[0]["name"] = "smaht-dev-srce-ContainerSecurityGroup"
    ecs.get_paginator.return_value.paginate.side_effect = ClientError(
        {"Error": {"Code": "AccessDenied"}}, "ListServices")
    assert_unresolved("network_aws_error:AccessDenied")


def test_unassociated_environment_cannot_use_cluster_network(network, monkeypatch):
    monkeypatch.setattr(tasks, "_get_task_definition_arns", lambda: [TASK.replace("smaht-dev-srce", "unknown")])
    assert_unresolved("task_cluster_missing_or_ambiguous")
    network[3].get_paginator.assert_not_called()


def test_unreadable_cluster_does_not_block_other_cluster(network, monkeypatch):
    _, _, _, ecs, service = network
    other = {key: "other-env" for key in ENV}
    cluster = CLUSTER.replace("smaht-dev-srce", "other-env")
    task = TASK.replace("smaht-dev-srce", "other-env")
    monkeypatch.setattr(tasks, "_get_cluster_arns", lambda: [CLUSTER, cluster])
    monkeypatch.setattr(tasks, "_get_task_definition_arns", lambda: [TASK, task])
    ecs.get_paginator.return_value.paginate.side_effect = [
        ClientError({"Error": {"Code": "AccessDenied"}}, "ListServices"),
        [{"serviceArns": ["other-service"]}]]
    result = tasks.get_aws_ecs_tasks_for_running(Envs([ENV.copy(), other]))
    assert result[0]["network_error"] == "network_aws_error:AccessDenied"
    assert result[1]["vpc"]["id"] == "vpc-Application"


def test_single_vpc_fallback_checks_resource_membership(network, monkeypatch):
    vpcs, subnets, groups, ecs, _ = network
    vpcs[:] = vpcs[:1]
    groups[0]["name"] = "smaht-dev-srce-ContainerSecurityGroup"
    groups[1]["name"] = "smaht-dev-srce-ContainerSecurityGroup"
    monkeypatch.setattr(discovery, "aws_get_subnets", lambda **kwargs: subnets)
    monkeypatch.setattr(discovery, "aws_get_security_groups", lambda **kwargs: groups)
    ecs.get_paginator.return_value.paginate.return_value = [{"serviceArns": []}]
    result = response()
    assert result["security_group"]["id"] == "sg-Application"
    assert result["subnets"] == [{"id": "subnet-Application", "name": "ApplicationPrivate"}]


def test_standard_blue_green_clusters_select_by_environment_color(network, monkeypatch):
    env = {key: "smaht-staging" for key in ENV}
    env.update(color="blue", is_staging=True)
    task = TASK.replace("smaht-dev-srce", "smaht-blue")
    blue = CLUSTER.replace("smaht-dev-srce", "smaht-blue")
    green = CLUSTER.replace("smaht-dev-srce", "smaht-green")
    monkeypatch.setattr(tasks, "_get_task_definition_arns", lambda: [task])
    monkeypatch.setattr(tasks, "_get_cluster_arns", lambda: [green, blue])
    result = tasks.get_aws_ecs_tasks_for_running(Envs([env]))[0]
    assert result["cluster_arn"] == blue
    assert result["vpc"]["id"] == "vpc-Application"
