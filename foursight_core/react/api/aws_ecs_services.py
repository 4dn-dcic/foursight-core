import boto3
from functools import lru_cache
import re
from typing import Optional, Tuple
from .aws_ecs_tasks import _get_task_definition_type, _shorten_arn, _shorten_task_definition_arn
from .datetime_utils import convert_datetime_to_utc_datetime_string as datetime_string
from .envs import Envs


def get_aws_ecs_services_for_update(envs: Envs, cluster_arn: str, args: Optional[dict] = None) -> list[dict]:

    # Cache build info result just within this function,
    # i.e. for the purposes of the below services loop.
    @lru_cache
    def get_build_digest(log_group: str, log_stream: str) -> Optional[str]:
        return get_aws_codebuild_digest(log_group, log_stream)

    def reorganize_response(services: dict) -> dict:
        if not services:
            return {}
        response = {
            "services": [],
            "image": services[0]["image"],
            "build": services[0]["build"],
            "env": services[0]["env"]
        }
        for service in services:
            del service["image"] 
            del service["build"] 
            del service["env"] 
            response["services"].append({**service})
        return response

    sanity_check = args.get("sanity_check", "").lower() == "true" if args else False
    services = get_aws_ecs_services_for_update_raw(cluster_arn)
    builds_and_images_identical = True
    previous_service = None
    for service in services:
        service["env"] = envs.get_associated_env(service["task_definition_arn"])
        if sanity_check:
            log_group = service["build"].get("log_group")
            log_stream = service["build"].get("log_stream")
            service["build"]["digest"] = get_build_digest(log_group, log_stream)
            service["image"]["sanity_checked_with_build"] = (
                service["build"].get("digest") == service["image"].get("digest"))
        if previous_service:
            if previous_service["build"] != service["build"] or previous_service["image"] != service["image"]:
                builds_and_images_identical = False
        previous_service = service
    if builds_and_images_identical:
        services = reorganize_response(services)
    return services


def get_aws_ecs_services_for_update_raw(cluster_arn: str) -> list[dict]:

    # Cache build info result just within this function,
    # i.e. for the purposes of the below services loop.
    @lru_cache
    def get_build_info(image_repo, image_tag):
        return get_aws_codebuild_info(image_repo, image_tag)

    response = []
    ecs = boto3.client("ecs")
    services = ecs.list_services(cluster=cluster_arn).get("serviceArns", [])
    for service in services:
        service_arn = _shorten_service_arn(service, cluster_arn)
        service_type = _get_service_type(service_arn)
        service_description = ecs.describe_services(cluster=cluster_arn, services=[service])["services"][0]
        task_definition_arn = _shorten_task_definition_arn(service_description["taskDefinition"])
        task_definition = ecs.describe_task_definition(taskDefinition=task_definition_arn)["taskDefinition"]
        container_definitions = task_definition["containerDefinitions"]
        if len(container_definitions) > 0:
            has_multiple_containers = len(container_definitions) > 1
            container_definition = task_definition["containerDefinitions"][0]
            container_name = container_definition["name"]
            image_arn = container_definition["image"]
            image_repo, image_tag = _get_image_info(image_arn)
            build_info = get_build_info(image_repo, image_tag)
            response.append({
                "cluster_arn": cluster_arn,
                "service_arn": service_arn,
                "service_type": service_type,
                "task_definition_arn": task_definition_arn,
                "container_name": container_name,
                "container_type": _get_container_type(container_name),
                "has_multiple_containers": has_multiple_containers,
                "image": {
                    "arn": image_arn,
                    "repo": image_repo,
                    "tag": image_tag,
                    **get_aws_ecr_image_info(image_repo, image_tag)
                },
                "build": build_info
            })
    return response


def get_aws_ecr_image_info(image_repo: str, image_tag: str) -> Optional[dict]:
    ecr = boto3.client("ecr")
    repos = ecr.describe_repositories()["repositories"]
    for repo in repos:
        repo_name = repo["repositoryName"]
        if repo_name == image_repo:
            images = ecr.describe_images(repositoryName=repo_name)["imageDetails"]
            for image in images:
                image_tags = image.get("imageTags", "")
                if image_tag in image_tags:
                    return {
                        "id": image.get("registryId"),
                        "digest": image.get("imageDigest"),
                        "size": image.get("imageSizeInBytes"),
                        "pushed_at": datetime_string(image.get("imagePushedAt"))
                    }
        return None


def get_aws_codebuild_info(image_repo: str, image_tag: str) -> Optional[dict]:

    def find_environment_variable(environment_variables: list[dict], name: str) -> Optional[str]:
        value = [item["value"] for item in environment_variables if item["name"] == name]
        return value[0] if len(value) == 1 else None

    codebuild = boto3.client("codebuild")
    projects =  codebuild.list_projects()["projects"]
    for project in projects:
        builds = codebuild.list_builds_for_project(projectName=project, sortOrder="DESCENDING")["ids"]
        if len(builds) > 0:
            most_recent_build_id = builds[0]
            most_recent_build = codebuild.batch_get_builds(ids=[most_recent_build_id])["builds"][0]
            environment_variables = most_recent_build.get("environment", {}).get("environmentVariables", {})
            most_recent_build_image_repo = find_environment_variable(environment_variables, "IMAGE_REPO_NAME")
            most_recent_build_image_tag = find_environment_variable(environment_variables, "IMAGE_TAG")
            if most_recent_build_image_repo == image_repo and most_recent_build_image_tag == image_tag:
                return {
                    "arn": _shorten_arn(most_recent_build["arn"]),
                    "project": project,
                    "github": most_recent_build.get("source", {}).get("location"),
                    "branch": most_recent_build["sourceVersion"],
                    "commit": most_recent_build["resolvedSourceVersion"],
                    "number": most_recent_build["buildNumber"],
                    "initiator": _shorten_arn(most_recent_build["initiator"]),
                    "status": most_recent_build["buildStatus"],
                    "success": most_recent_build["buildStatus"] == "SUCCEEDED",
                    "finished": most_recent_build["buildComplete"],
                    "started_at": datetime_string(most_recent_build.get("startTime")),
                    "finished_at": datetime_string(most_recent_build.get("endTime")),
                    "log_group": most_recent_build["logs"]["groupName"],
                    "log_stream": most_recent_build["logs"]["streamName"]
                }


def get_aws_codebuild_digest(log_group: str, log_stream: str) -> Optional[str]:
    sha256_pattern = re.compile(r"sha256:([0-9a-f]{64})")
    logs = boto3.client("logs")
    log_events = logs.get_log_events(logGroupName=log_group, logStreamName=log_stream, startFromHead=True)["events"]
    for log_event in log_events:
        message = log_event.get("message")
        if message and "digest" in message:
            match = sha256_pattern.search(message)
            if match:
                return "sha256:" + match.group(1)
    return None


def _shorten_service_arn(service_arn: str, cluster_arn: str) -> str:
    service_arn = _shorten_arn(service_arn)
    if service_arn.startswith(f"{cluster_arn}/"):
        service_arn = service_arn.replace(f"{cluster_arn}/", "")
    return service_arn


def _get_service_type(service_arn: str) -> str:
    return _get_task_definition_type(service_arn)


def _get_container_type(container_name: str) -> str:
    return _get_task_definition_type(container_name)


def _get_image_info(image_arn: str) -> Tuple[Optional[str], Optional[str]]:
    image_arn = _shorten_arn(image_arn)
    parts = image_arn.split(":")
    return (parts[0], parts[1]) if len(parts) == 2 else (None, None)
