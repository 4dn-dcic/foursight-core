import boto3
import json
from typing import Dict, List, Optional
from dcicutils.ecs_utils import ECSUtils
from dcicutils.misc_utils import get_error_message
from .aws_ecs_types import get_cluster_associated_with_env, get_task_definition_type
from .aws_ecs_task_network import get_task_network
from .datetime_utils import convert_datetime_to_utc_datetime_string as datetime_string
from .envs import Envs
from .portal_access_key_utils import get_portal_access_key_info

# Functions to get AWS cluster and task info with the original
# end purpose of supporting reindexing from the Foursight UI.


def get_aws_ecs_tasks_for_running(envs: Envs, task_definition_type: Optional[str] = None) -> List:

    given_task_definition_type = task_definition_type.lower() if task_definition_type else None
    task_definition_arns = _get_task_definition_arns()
    tasks_for_running = []

    def get_cluster_for_env(clusters: List[str], env: Optional[Dict]) -> Optional[str]:
        if not env:
            return None
        matches = [cluster for cluster in clusters
                   if get_cluster_associated_with_env(env, envs=envs, clusters=[cluster])]
        return matches[0] if len(matches) == 1 else None

    def add_task_for_running(task: Dict) -> None:
        # Add the given task to the given task list, but make sure we don't have a duplicate,
        # meaning more than one task with the same "name" (i.e. e.g. "deploy") as determined
        # by the get_task_definition_type function definition, above); and for the same
        # environment, as determined by the get_assocated_env function call, below.
        duplicate_tasks = [existing_task for existing_task in tasks_for_running
                           if existing_task["type"] == task["type"]
                           and existing_task["env"] == task["env"]]
        if duplicate_tasks:
            # Since we are doing this as we go we are
            # guaranteed to get at most only one of these.
            existing_task = duplicate_tasks[0]
            ecs = boto3.client("ecs")
            existing_task_definition = (
                ecs.describe_task_definition(taskDefinition=existing_task["task_definition_arn"])["taskDefinition"])
            this_task_definition = (
                ecs.describe_task_definition(taskDefinition=task["task_definition_arn"])["taskDefinition"])
            existing_task_registered_at = existing_task_definition.get("registeredAt")
            this_task_registered_at = this_task_definition.get("registeredAt")
            if (("mirror" in this_task_definition.get("taskDefinitionArn").lower()) and not
                    ("mirror" in existing_task_definition.get("taskDefinitionArn").lower())):
                # The existing task is not a "mirror" but the given task is; skip this given one;
                # and do not even regard this as a duplicate.
                return
            elif (("mirror" in existing_task_definition.get("taskDefinitionArn").lower()) and not
                  ("mirror" in this_task_definition.get("taskDefinitionArn").lower())):
                # This given task is not a "mirror" but the existing task is; remove the existing one.
                # and do not even regard this as a duplicate.
                tasks_for_running.remove(existing_task)
                tasks_for_running.append(task)
                return
            if existing_task_registered_at and this_task_registered_at:
                if existing_task_registered_at > this_task_registered_at:
                    # The existing task is newer than this given task; skip this given one.
                    existing_task["registered_at"] = datetime_string(existing_task_registered_at)
                    if not existing_task.get("duplicates"):
                        existing_task["duplicates"] = []
                    existing_task["duplicates"].append({
                        "task_definition_arn": task["task_definition_arn"],
                        "registered_at": datetime_string(this_task_registered_at)
                     })
                    return
                else:
                    # The given task is newer than the existing task; remove the existing one.
                    task["registered_at"] = datetime_string(this_task_registered_at)
                    task["duplicates"] = existing_task.get("duplicates") or []
                    task["duplicates"].append({
                        "task_definition_arn": existing_task["task_definition_arn"],
                        "registered_at": datetime_string(existing_task_registered_at)
                     })
                    tasks_for_running.remove(existing_task)
        tasks_for_running.append(task)

    clusters = _get_cluster_arns()
    service_cache = {}

    for task_definition_arn in task_definition_arns:
        task_definition_type = get_task_definition_type(task_definition_arn) or task_definition_arn
        if given_task_definition_type and given_task_definition_type != task_definition_type:
            continue
        task_env = envs.get_associated_env(task_definition_arn)
        task_for_running = {
            "task_definition_arn": task_definition_arn,
            "type": task_definition_type,
            "env": task_env
        }
        # Get the AWS cluster to use for any task run for this particular environment.
        cluster_for_env = get_cluster_for_env(clusters, task_env)
        if cluster_for_env:
            task_for_running["cluster_arn"] = cluster_for_env
        task_for_running.update(get_task_network(envs, task_env, task_definition_arn,
                                                 cluster_for_env, service_cache))
        # Add this task to the results (handles "duplicates").
        add_task_for_running(task_for_running)
    return tasks_for_running


def get_aws_ecs_task_running(envs: Envs,
                             cluster_arn: str,
                             task_definition_arn: str,
                             check_other_clusters: bool = True) -> Dict:
    """
    Returns an indication of if the given task definition is currently running.
    Note that if the given task definition ARN is not valid or does not exist,
    then NO indication of this is given; it will just say it is not running.
    """
    task_arns = _get_task_arns(cluster_arn, task_definition_arn)
    task_is_running = len(task_arns) > 0
    # TODO: See if the given task is running in any other cluser
    task_definition_type = get_task_definition_type(task_definition_arn) or task_definition_arn
    response = {
        "cluster_arn": cluster_arn,
        "task_definition_arn": task_definition_arn,
        "type": task_definition_type,
        "task_running": task_is_running
    }
    if not task_is_running and check_other_clusters:
        for cluster_arn in [item for item in _get_cluster_arns() if item != cluster_arn]:
            sub_response = get_aws_ecs_task_running(envs,
                                                    cluster_arn=cluster_arn,
                                                    task_definition_arn=task_definition_arn,
                                                    check_other_clusters=False)
            if sub_response["task_running"]:
                sub_response["other_cluster"] = True
                return sub_response
    if task_is_running:
        response["task_running_ids"] = [_get_task_running_id(item) for item in task_arns]
    return response


def get_aws_ecs_task_last_run(envs: Envs, cluster_arn: str, task_definition_arn: str) -> Dict:
    # If this is the deploy task the approximate that last time it was run by using the
    # create date of the Portal Access Key as a proxy for when this task last ran since
    # the entrypoint_deployment.bash script creates this as its last step.
    # This is only separate from get_aws_ecs_task_running for performance
    # and responsiveness response within the (React) UI.
    task_definition_type = get_task_definition_type(task_definition_arn) or task_definition_arn
    response = {
        "cluster_arn": cluster_arn,
        "task_definition_arn": task_definition_arn,
        "type": task_definition_type,
    }
    if task_definition_type == "deploy":
        task_env = envs.get_associated_env(task_definition_arn)
        if task_env:
            portal_access_key_info = get_portal_access_key_info(task_env["full_name"], logged_in=True)
            if portal_access_key_info:
                response["task_last_ran_at"] = portal_access_key_info["created_at"]
                response["portal_access_key"] = portal_access_key_info["key"]  # Just FYI
    return response


def get_aws_ecs_tasks_running(cluster_arn: Optional[str] = None,
                              task_definition_type: Optional[str] = None,
                              task_definition_arn: Optional[str] = None) -> List[Dict]:
    """
    Returns a list of all tasks running within the given cluster (ARN).
    This list is groups by task definition (ARN), which each containing
    the list of task IDs of associated tasks running.
    """
    if not cluster_arn:
        return get_aws_ecs_tasks_running_across_clusters(task_definition_type=task_definition_type,
                                                         task_definition_arn=task_definition_arn)
    response = []
    ecs = boto3.client("ecs")
    task_arns = ecs.list_tasks(cluster=cluster_arn).get("taskArns")
    if task_arns:
        given_task_definition_type = task_definition_type
        given_task_definition_arn = task_definition_arn
        tasks = ecs.describe_tasks(cluster=cluster_arn, tasks=task_arns).get("tasks")
        for task in tasks:
            task_definition_arn = _shortened_task_definition_arn(task.get("taskDefinitionArn"))
            if given_task_definition_arn and given_task_definition_arn != task_definition_arn:
                continue
            task_definition_type = get_task_definition_type(task_definition_arn) or task_definition_arn
            if given_task_definition_type and given_task_definition_type != task_definition_type:
                continue
            task = {
                "id": _get_task_running_id(task.get("taskArn")),
                "started_at": datetime_string(task.get("startedAt") or task.get("createdAt"))
            }
            if not given_task_definition_arn:
                task["cluster_arn"] = cluster_arn
                existing_task = [item for item in response if item["task_definition_arn"] == task_definition_arn]
            else:
                existing_task = [item for item in response if item["cluster_arn"] == cluster_arn]
            if existing_task:
                existing_task[0]["tasks"].append(task)
            elif not given_task_definition_arn:
                response.append({"task_definition_arn": task_definition_arn,
                                 "type": get_task_definition_type(task_definition_arn) or task_definition_arn,
                                 "tasks": [task]})
            else:
                response.append({"cluster_arn": cluster_arn,
                                 "task_definition_arn": given_task_definition_arn,
                                 "type": get_task_definition_type(task_definition_arn) or task_definition_arn,
                                 "tasks": [task]})
    return response


def get_aws_ecs_tasks_running_across_clusters(task_definition_type: Optional[str] = None,
                                              task_definition_arn: Optional[str] = None) -> List[Dict]:
    """
    Returns tasks running across any/all clusters.
    If a task_definition_arn is given the the response is will contain only tasks which are
    instances of that task_definition_arn grouped, and the response is grouped by by cluster_arn.
    If a task_definition_arn is not given the the response is grouped by task_definition_arn.
    """
    response = []
    cluster_arns = [item for item in _get_cluster_arns()]
    for cluster_arn in cluster_arns:
        tasks = get_aws_ecs_tasks_running(cluster_arn, task_definition_type, task_definition_arn)
        for task in tasks:
            if not task_definition_arn:
                existing_task = (
                    [item for item in response if item["task_definition_arn"] == task["task_definition_arn"]])
            else:
                existing_task = [item for item in response if item["cluster_arn"] == task["cluster_arn"]]
            if existing_task:
                existing_task[0]["tasks"].extend(task["tasks"])
            else:
                response.append(task)
    return response


def aws_ecs_run_task(cluster_arn: str, task_definition_arn: str, args: Dict) -> Dict:
    subnets = args.get("subnets")
    security_group = args.get("security_group")
    subnets = [item["id"] for item in subnets]
    security_group = security_group["id"]
    network_configuration = {
        "awsvpcConfiguration": {
            "subnets": subnets,
            "securityGroups": [security_group],
            "assignPublicIp": "DISABLED"
        }
    }
    # TODO: The dcicutils.ecs_utils.run_ecs_task function does not specify specify
    # container launchType (FARGATE), for some reason, one of which is required.
    # ecs = ECSUtils()
    # response = ecs.run_ecs_task(
    #     cluster_name=cluster_arn,
    #     task_definition_type=task_definition_arn,
    #     subnet=subnets,  # TODO
    #     security_group=security_group
    # )
    try:
        response = {
            "cluster_arn": cluster_arn,
            "task_definition_arn": task_definition_arn,
            "security_group": security_group,
            "subnets": subnets
        }
        ecs = boto3.client("ecs")
        run_task_response = ecs.run_task(
            launchType="FARGATE",
            count=1,
            cluster=cluster_arn,
            taskDefinition=task_definition_arn,
            networkConfiguration=network_configuration
        )
        response["task_running_id"] = _get_task_running_id(run_task_response.get("tasks", [{}])[0].get("taskArn"))
        response["response"] = json.loads(json.dumps(run_task_response, default=str))
    except Exception as e:
        response["error"] = get_error_message(e)
    return response


def _get_cluster_arns() -> List[str]:
    ecs = ECSUtils()
    return sorted([_shortened_arn(item) for item in ecs.list_ecs_clusters()])


def _get_task_definition_arns() -> List[str]:
    ecs = ECSUtils()
    return sorted(list(set([_shortened_task_definition_arn(item) for item in ecs.list_ecs_tasks()])))


def _get_task_arns(cluster_arn: str, task_definition_arn: str) -> List[str]:
    ecs = boto3.client("ecs")
    return ecs.list_tasks(cluster=cluster_arn, family=task_definition_arn).get("taskArns")


def _shortened_arn(arn: str) -> str:
    arn_parts = arn.split("/", 1) if arn else []
    return arn_parts[1] if len(arn_parts) > 1 else arn


def _shortened_task_definition_arn(task_definition_arn: str) -> str:
    """
    Given something like this:
    - arn:aws:ecs:us-east-1:466564410312:task-definition/c4-ecs-cgap-supertest-stack-CGAPDeployment-of2dr96JX1ds:1
    this function would return this:
    - c4-ecs-cgap-supertest-stack-CGAPDeployment-of2dr96JX1ds
    """
    task_definition_arn = _shortened_arn(task_definition_arn)
    arn_parts = task_definition_arn.rsplit(":", 1) if task_definition_arn else []
    return arn_parts[0] if len(arn_parts) > 1 else task_definition_arn


def _get_task_running_id(task_arn: str) -> str:
    return task_arn.split("/")[-1] if "/" in task_arn else task_arn
