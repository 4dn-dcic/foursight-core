import boto3
from functools import lru_cache
import re
import time
from typing import Callable, Optional, Tuple
from dcicutils.task_utils import pmap
from .aws_ecs_tasks import _get_task_definition_type, _shorten_arn, _shorten_task_definition_arn
from .datetime_utils import convert_datetime_to_utc_datetime_string as datetime_string
from .envs import Envs


def get_aws_ecs_services_for_update(envs: Envs, cluster_arn: str, args: Optional[dict] = None) -> list[dict]:

    # Cache build info result just within this function,
    # i.e. for the purposes of the below services loop.
    @lru_cache
    def get_build_digest(log_group: str, log_stream: str) -> Optional[str]:
        return _get_aws_codebuild_digest(log_group, log_stream)

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

    started = time.time()
    sanity_check = args.get("sanity_check", "").lower() == "true" if args else False
    parallel = args.get("parallel", "").lower() != "false" if args else True
    services = _get_aws_ecs_services_for_update_raw(cluster_arn, parallel=parallel)
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
            if (previous_service["build"] != service["build"] or
                previous_service["image"] != service["image"] or
                previous_service["env"] != service["env"]):
                builds_and_images_identical = False
        previous_service = service
    if builds_and_images_identical:
        services = reorganize_response(services)
    duration = time.time() - started
    minutes, seconds = divmod(duration, 60)
    seconds, milliseconds = divmod(seconds, 1)
    duration = f"{int(minutes):02d}:{int(seconds):02d}.{int(milliseconds * 1000):03d}"
    if builds_and_images_identical:
        services["duration"] = duration
    else:
        services[0]["duration"] = duration
    return services


def _get_aws_ecs_services_for_update_raw(cluster_arn: str, parallel: bool = True) -> list[dict]:

    ecs = boto3.client("ecs")

    def get_service_info(service_arn: str) -> dict:
        response = {}
        service_arn = _shorten_service_arn(service_arn, cluster_arn)
        service_type = _get_service_type(service_arn)
        service_description = ecs.describe_services(cluster=cluster_arn, services=[service_arn])["services"][0]
        task_definition_arn = _shorten_task_definition_arn(service_description["taskDefinition"])
        task_definition = ecs.describe_task_definition(taskDefinition=task_definition_arn)["taskDefinition"]
        container_definitions = task_definition["containerDefinitions"]
        if len(container_definitions) > 0:
            has_multiple_containers = len(container_definitions) > 1
            container_definition = task_definition["containerDefinitions"][0]
            container_name = container_definition["name"]
            image_arn = container_definition["image"]
            response = {
                "cluster_arn": cluster_arn,
                "service_arn": service_arn,
                "service_type": service_type,
                "task_definition_arn": task_definition_arn,
                "container_name": container_name,
                "container_type": _get_container_type(container_name),
                "has_multiple_containers": has_multiple_containers,
                "image": {
                    "arn": image_arn
                }
            }
        return response

    @lru_cache
    def get_build_info(image_repo, image_tag):
        # Cache image info result within this function; for the below services loop.
        return _get_aws_codebuild_info(image_repo, image_tag)

    @lru_cache
    def get_image_info(image_repo, image_tag):
        # Cache image info result within this function, for the below services loop.
        return _get_aws_ecr_image_info(image_repo, image_tag)

    def get_build_or_image_info(info: Tuple[str, Callable, str, str]) -> Tuple[str, dict]:
        name = info[0]
        function = info[1]
        image_repo = info[2]
        image_tag = info[3]
        return (name, function(image_repo, image_tag))

    service_arns = ecs.list_services(cluster=cluster_arn).get("serviceArns", [])
    if parallel:
        # For better performance we get each service info in parallel.  
        # But, since, typically, the image/build info for each service will be exactly the same,
        # we don't include the retrieval of these in the concurrently executed code since we will,
        # typically, only need a single call to get this image/biuld info anyways; and including the
        # retrieval of this would mess up the concurrency of the local caching of this image/build info.
        services = [service for service in pmap(get_service_info, service_arns)]
    else:
        services = [get_service_info(service) for service in service_arns]
    # Now get the image/build info for each service.
    for service in services:
        image_repo, image_tag = _get_image_repo_and_tag(service["image"]["arn"])
        if image_repo and image_tag:
            if parallel:
                # Also why not get image and build info concurrently relative to each other.
                info = {name: info for name, info
                        in pmap(get_build_or_image_info, [("image", get_image_info, image_repo, image_tag),
                                                          ("build", get_build_info, image_repo, image_tag)])}
            else:
                info = {"image": get_image_info(image_repo, image_tag), "build": get_build_info(image_repo, image_tag)}
            service["image"] = {**service["image"], **info["image"]}
            service["build"] = info["build"]
    return services


def _get_aws_ecr_image_info(image_repo: str, image_tag: str) -> Optional[dict]:
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
                        "repo": image_repo,
                        "tag": image_tag,
                        "digest": image.get("imageDigest"),
                        "size": image.get("imageSizeInBytes"),
                        "pushed_at": datetime_string(image.get("imagePushedAt")),
                        "pulled_at": datetime_string(image.get("lastRecordedPullTime"))
                    }
    return None


def _get_aws_codebuild_info(image_repo: str, image_tag: str) -> Optional[dict]:

    def find_environment_variable(environment_variables: list[dict], name: str) -> Optional[str]:
        value = [item["value"] for item in environment_variables if item["name"] == name]
        return value[0] if len(value) == 1 else None

    def create_record(build: dict) -> dict:
        return {
            "arn": _shorten_arn(build["arn"]),
            "project": project,
            "github": build.get("source", {}).get("location"),
            "branch": build["sourceVersion"],
            "commit": build["resolvedSourceVersion"],
            "number": build["buildNumber"],
            "initiator": _shorten_arn(build["initiator"]),
            "status": build["buildStatus"],
            "success": build["buildStatus"].lower() == "SUCCEEDED" or build["buildStatus"].lower() == "SUCCESS",
            "finished": build["buildComplete"],
            "started_at": datetime_string(build.get("startTime")),
            "finished_at": datetime_string(build.get("endTime")),
            "log_group": build["logs"]["groupName"],
            "log_stream": build["logs"]["streamName"]
        }

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
                return create_record(most_recent_build)
    return None


def _get_aws_codebuild_digest(log_group: str, log_stream: str) -> Optional[str]:
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

def _get_image_repo_and_tag(image_arn: str) -> Tuple[Optional[str], Optional[str]]:
    image_arn = _shorten_arn(image_arn)
    parts = image_arn.split(":")
    return (parts[0], parts[1]) if len(parts) == 2 else (None, None)
