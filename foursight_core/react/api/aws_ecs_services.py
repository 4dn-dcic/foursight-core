import boto3
import datetime
from functools import lru_cache
import pytz
import re
import time
from typing import Callable, Dict, List, Generator, Optional, Tuple, Union
from dcicutils.ecs_utils import ECSUtils
from .aws_ecs_tasks import (
    _get_cluster_arns, _get_task_running_id,
    _get_task_definition_type, _shortened_arn, _shortened_task_definition_arn
)
from .datetime_utils import convert_datetime_to_utc_datetime_string as datetime_string
from .envs import Envs
from .misc_utils import run_concurrently, run_functions_concurrently

# Functions to get AWS cluster and services info with the
# original end purpose of supporting redeploying via Foursight.

record_reindex_kickoff_via_tags = True


def get_aws_ecs_clusters_for_update(envs: Envs, args: Optional[Dict] = None) -> List[Dict]:
    response = []
    for cluster_arn in _get_cluster_arns():
        cluster_env = envs.get_associated_env(cluster_arn)
        if cluster_env:
            response.append({
                "cluster_arn": cluster_arn,
                "env": cluster_env
            })
    return response


def get_aws_ecs_services_for_update(envs: Envs, cluster_arn: str,
                                    args: Optional[Dict] = None) -> Union[Dict, List[Dict]]:
    """
    Returns the list of AWS services (for possible update purposes) within the given cluster (ARN).
    If all of the services have the same image, build, and environment info (which is typical/expected
    use case), then a dictionary is returned within which is the list of services, as well as the image,
    build, and environment info; otherwise a list is returned of the each service, within each of which
    is the associated image, build, and environment info. If a "sanity_check" boolean argument is passed
    in which is "true", then also included is the digest information for the build; this is not the default
    since to get it we have to go read the build logs; there is another function (get_aws_codebuild_digest)
    to get this specifically, so that (for example) this could be called asynchronously from a UI; this
    digest information is useful to sanity check the the image and associated build digest match.
    """

    def reorganize_response(services: Dict) -> Dict:
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
        response["services"] = sorted(response["services"], key=lambda item: item["type"])
        return response

    def has_identitical_metadata(service: Dict, previous_service: Dict) -> bool:
        return (service["build"] == previous_service["build"] and
                service["image"] == previous_service["image"] and
                service["env"] == previous_service["env"])

    sanity_check = args.get("sanity_check", "").lower() == "true" if args else False
    identical_metadata = True
    previous_service = None
    services = _get_aws_ecs_services_for_update_raw(cluster_arn, include_build_digest=sanity_check)
    for service in services:
        service["env"] = envs.get_associated_env(service["task_definition_arn"])
        if sanity_check:
            image_digest = service["image"].get("digest")
            build_digest = service["build"].get("latest", {}).get("digest")
            service["image"]["sanity_checked_with_build"] = image_digest == build_digest
        if previous_service and not has_identitical_metadata(service, previous_service):
            identical_metadata = False
        previous_service = service
    return reorganize_response(services) if identical_metadata else services


def get_aws_codebuild_digest(log_group: str, log_stream: str, image_tag: Optional[str] = None) -> Optional[str]:
    logs = boto3.client("logs")
    sha256_pattern = re.compile(r"sha256:([0-9a-f]{64})")
    # For some reason this (rarely-ish) intermittently fails with no error;
    # the results just do not contain the digest; don't know why so try a few times.
    ntries = 7
    while ntries > 0:
        if ntries > 1:
            time.sleep(0.2)
        log_events = logs.get_log_events(logGroupName=log_group, logStreamName=log_stream, startFromHead=True)["events"]
        for log_event in log_events:
            msg = log_event.get("message")
            # The entrypoint_deployment.bash script at least partially
            # creates this log output, which includes a line like this:
            # green: digest: sha256:c1204f9ff576105d9a56828e2c0645cc6dbcf91abca767ef6fe033a60c483f10 size: 7632
            if msg and "digest:" in msg and "size:" in msg and (not image_tag or f"{image_tag}:" in msg):
                match = sha256_pattern.search(msg)
                if match:
                    return "sha256:" + match.group(1)
        ntries -= 1
    return None


def aws_ecs_update_cluster(cluster_arn: str, user: Optional[str] = None) -> Dict:
    ecs = ECSUtils()
    if record_reindex_kickoff_via_tags:
        full_cluster_arn = ecs.client.describe_clusters(clusters=[cluster_arn])["clusters"][0]["clusterArn"]
        if record_reindex_kickoff_via_tags:
            tags = [
                {"key": "last_redeploy_kickoff_at", "value": datetime_string(datetime.datetime.now(pytz.UTC))},
                {"key": "last_redeploy_kickoff_by", "value": user or "unknown"}
            ]
        ecs.client.tag_resource(resourceArn=full_cluster_arn, tags=tags)
    return {"status": ecs.update_all_services(cluster_name=cluster_arn)}


def aws_ecs_cluster_status(cluster_arn: str) -> Optional[Dict]:

    ecs = boto3.client("ecs")

    if record_reindex_kickoff_via_tags:
        # We need the full cluster ARN to deal with (cluster) tags;
        # but we generally deal with the shortened version; so we get it
        # below within get_tasks_info as we don't want to make an extra call.
        full_cluster_arn = None

    def get_services_info() -> List[Dict]:
        return _get_aws_ecs_services_for_update_raw(cluster_arn, include_image_and_build_info=False)

    def get_tasks_info() -> Dict:
        response = []
        task_arns = ecs.list_tasks(cluster=cluster_arn).get("taskArns")
        tasks = ecs.describe_tasks(cluster=cluster_arn, tasks=task_arns).get("tasks")
        if record_reindex_kickoff_via_tags:
            nonlocal full_cluster_arn
            if not full_cluster_arn and len(tasks) > 0:
                full_cluster_arn = tasks[0]["clusterArn"]
        most_recent_task_started_at = None
        for task in tasks:
            task_started_at = task.get("startedAt")
            if task_started_at and (not most_recent_task_started_at or task_started_at > most_recent_task_started_at):
                most_recent_task_started_at = task_started_at
            response.append({
                "task_running_id": _get_task_running_id(task.get("taskArn")),
                "task_definition_arn": task.get("taskDefinitionArn"),
                "status": task.get("lastStatus"),
                "started_at": task.get("startedAt")
            })
        return response

    info = run_functions_concurrently([get_services_info, get_tasks_info])
    services = info[0]
    tasks = info[1]

    response = {"services": services, "tasks": tasks}
    most_recent_task_started_at = None
    for task in tasks:
        task_started_at = task["started_at"]
        task["started_at"] = datetime_string(task_started_at)
        if task_started_at and (not most_recent_task_started_at or task_started_at > most_recent_task_started_at):
            most_recent_task_started_at = task_started_at
    response["tasks_running_count"] = sum(service["tasks_running_count"] for service in services) or 0
    response["tasks_running_count"] = sum(service["tasks_running_count"] for service in services) or 0
    response["tasks_pending_count"] = sum(service["tasks_pending_count"] for service in services) or 0
    response["tasks_desired_count"] = sum(service["tasks_desired_count"] for service in services) or 0
    response["started_at"] = datetime_string(most_recent_task_started_at)
    response["updating"] = (any(service["updating"] for service in services) or
                            response["tasks_running_count"] < len(tasks))
    if record_reindex_kickoff_via_tags:
        tags = ecs.list_tags_for_resource(resourceArn=full_cluster_arn).get("tags")
        last_redeploy_kickoff_at = [tag.get("value") for tag in tags if tag.get("key") == "last_redeploy_kickoff_at"]
        last_redeploy_kickoff_at = last_redeploy_kickoff_at[0] if last_redeploy_kickoff_at else None
        last_redeploy_kickoff_by = [tag.get("value") for tag in tags if tag.get("key") == "last_redeploy_kickoff_by"]
        last_redeploy_kickoff_by = last_redeploy_kickoff_by[0] if last_redeploy_kickoff_by else None
        if last_redeploy_kickoff_at:
            response["last_redeploy_kickoff_at"] = last_redeploy_kickoff_at
            if response["started_at"] and response["started_at"] < last_redeploy_kickoff_at:
                response["updating"] = True
        if last_redeploy_kickoff_by:
            response["last_redeploy_kickoff_by"] = last_redeploy_kickoff_by
    return response


def _get_aws_ecs_services_for_update_raw(cluster_arn: str,
                                         include_build_digest: bool = False,
                                         include_image_and_build_info: bool = True) -> List[Dict]:

    ecs = boto3.client("ecs")

    def get_service_info(service_arn: str) -> Dict:

        def get_service_type(service_arn: str) -> str:
            return _get_task_definition_type(service_arn)

        def shortened_service_arn(service_arn: str, cluster_arn: str) -> str:
            service_arn = _shortened_arn(service_arn)
            if service_arn.startswith(f"{cluster_arn}/"):
                service_arn = service_arn.replace(f"{cluster_arn}/", "")
            return service_arn

        response = {}
        service_arn = shortened_service_arn(service_arn, cluster_arn)
        service_description = ecs.describe_services(cluster=cluster_arn, services=[service_arn])["services"][0]
        task_definition_arn = _shortened_task_definition_arn(service_description["taskDefinition"])
        task_definition = ecs.describe_task_definition(taskDefinition=task_definition_arn)["taskDefinition"]
        container_definitions = task_definition["containerDefinitions"]
        if len(container_definitions) > 0:
            tasks_running_count = service_description.get("runningCount")
            tasks_pending_count = service_description.get("pendingCount")
            tasks_desired_count = service_description.get("desiredCount")
            has_multiple_containers = len(container_definitions) > 1
            container_definition = task_definition["containerDefinitions"][0]
            response = {
                "arn": service_arn,
                "type": get_service_type(service_arn),
                "task_definition_arn": task_definition_arn,
                "tasks_running_count": tasks_running_count,
                "tasks_pending_count": tasks_pending_count,
                "tasks_desired_count": tasks_desired_count,
                "updating": tasks_pending_count > 0 or tasks_desired_count != tasks_running_count
            }
            if include_image_and_build_info:
                response["image"] = {"arn": container_definition["image"]}
            if has_multiple_containers:
                response["warning_has_multiple_containers"] = True
        return response

    @lru_cache
    def get_build_info(image_repo: str, image_tag: str) -> Optional[Dict]:
        # Cache this result within the enclosing function; for the below services loop.
        build = _get_aws_codebuild_info(image_repo, image_tag)
        if include_build_digest:
            log_group = build.get("latest", {}).get("log_group")
            log_stream = build.get("latest", {}).get("log_stream")
            build["latest"]["digest"] = get_build_digest(log_group, log_stream, image_tag)
        return build

    @lru_cache
    def get_build_digest(log_group: str, log_stream: str, image_tag: Optional[str] = None) -> Optional[str]:
        # Cache this result within the enclosing function; for the below services loop.
        return get_aws_codebuild_digest(log_group, log_stream, image_tag)

    @lru_cache
    def get_image_info(image_repo: str, image_tag: str) -> Optional[Dict]:
        # Cache this result within the enclosing function; for the below services loop.
        return _get_aws_ecr_image_info(image_repo, image_tag)

    def get_build_or_image_info(info: Tuple[str, Callable, str, str]) -> Tuple[str, Dict]:
        name = info[0]
        function = info[1]
        image_repo = info[2]
        image_tag = info[3]
        return (name, function(image_repo, image_tag))

    def get_image_repo_and_tag(image_arn: str) -> Tuple[Optional[str], Optional[str]]:
        image_arn = _shortened_arn(image_arn)
        parts = image_arn.split(":")
        return (parts[0], parts[1]) if len(parts) == 2 else (None, None)

    service_arns = ecs.list_services(cluster=cluster_arn).get("serviceArns", [])
    # For better performance we get each service info in parallel.
    # But, since, typically, the image/build info for each service will be exactly the same,
    # we don't include the retrieval of these in the concurrently executed code since we will,
    # typically, only need a single call to get this image/biuld info anyways; and including the
    # retrieval of this would mess up the concurrency of the local caching of this image/build info.
    # Also get the image and build info concurrently relative to each other.
    services = [service for service in run_concurrently(get_service_info, service_arns)]
    # Now get the image/build info for each service; concurrently for performance only.
    if include_image_and_build_info:
        for service in services:
            image_repo, image_tag = get_image_repo_and_tag(service["image"]["arn"])
            if image_repo and image_tag:
                info = run_functions_concurrently([
                    lambda: get_image_info(image_repo, image_tag),
                    lambda: get_build_info(image_repo, image_tag),
                ])
                service["image"] = {**service["image"], **info[0]}
                service["build"] = info[1]
    return services


def _get_aws_ecr_image_info(image_repo: str, image_tag: str) -> Optional[Dict]:
    """
    Returns AWS ECR image info for the given image repo and tag.
    """

    def create_image_info(image_repo: str, image_tag: str, image: Dict) -> Dict:
        return {
            "id": image.get("registryId"),
            "repo": image_repo,
            "tag": image_tag,
            "size": image.get("imageSizeInBytes"),
            "digest": image.get("imageDigest"),
            "pushed_at": datetime_string(image.get("imagePushedAt")),
            "pulled_at": datetime_string(image.get("lastRecordedPullTime"))
        }

    ecr = boto3.client("ecr")
    repos = ecr.describe_repositories()["repositories"]
    for repo in repos:
        repo_name = repo["repositoryName"]
        if repo_name == image_repo:
            next_token = None
            while True:
                if next_token:
                    images = ecr.describe_images(repositoryName=repo_name, nextToken=next_token)
                else:
                    images = ecr.describe_images(repositoryName=repo_name)
                next_token = images.get("nextToken")
                images = images["imageDetails"]
                for image in images:
                    if image_tag in image.get("imageTags", []):
                        return create_image_info(image_repo, image_tag, image)
                if not next_token:
                    break
    return None


def _get_aws_codebuild_info(image_repo: str, image_tag: str) -> Optional[Dict]:
    """
    Returns a dictionary with info about the three most recent CodeBuild builds
    for the given image repo and tag, or None if none found.
    """

    codebuild = boto3.client("codebuild")

    def get_projects() -> List[str]:

        projects = codebuild.list_projects()["projects"]

        # If there is a project with the same name as the image_repo then look at that one first,
        # or secondarily, prefer projects whose names contain the image_repo and/or image_tag;
        # we do this just for performance, to try to reduce the number of boto calls we make.

        def prefer_project(preferred_project: str):
            projects.remove(preferred_project)
            return [preferred_project, *projects]

        preferred_project = [project for project in projects if project == image_repo]
        if preferred_project:
            return prefer_project(preferred_project[0])
        preferred_project = [project for project in projects
                             if image_repo.lower() in project.lower() and image_tag.lower() in project.lower()]
        if preferred_project:
            return prefer_project(preferred_project[0])
        preferred_project = [project for project in projects if image_repo.lower() in project.lower()]
        if preferred_project:
            return prefer_project(preferred_project[0])
        preferred_project = [project for project in projects if image_tag.lower() in project.lower()]
        if preferred_project:
            return prefer_project(preferred_project[0])
        return projects

    def get_relevant_builds(project: str) -> Generator[Optional[Dict], None, None]:

        # For efficiency, and the most common actual case, get builds three at a time; i.e. since we
        # want to the three most recent (relevant) builds, and they are usually together at the start
        # of the (list_build_for_projects) list ordered (descending) by build (creation) time;
        # but of course, just in case, we need to handle the general case.

        def get_relevant_build_info(build: Optional[Dict]) -> Optional[Dict]:

            def find_environment_variable(environment_variables: List[Dict], name: str) -> Optional[str]:
                value = [item["value"] for item in environment_variables if item["name"] == name]
                return value[0] if len(value) == 1 else None

            if build:
                environment_variables = build.get("environment", {}).get("environmentVariables", {})
                build_image_repo = find_environment_variable(environment_variables, "IMAGE_REPO_NAME")
                build_image_tag = find_environment_variable(environment_variables, "IMAGE_TAG")
                if build_image_repo == image_repo and build_image_tag == image_tag:
                    return create_build_info(build)
            return None

        next_token = None
        while True:
            if next_token:
                build_ids = codebuild.list_builds_for_project(projectName=project,
                                                              sortOrder="DESCENDING", nextToken=next_token)
            else:
                build_ids = codebuild.list_builds_for_project(projectName=project, sortOrder="DESCENDING")
            next_token = build_ids.get("nextToken")
            build_ids = build_ids["ids"]
            for i in range(0, len(build_ids), 3):
                if i + 2 < len(build_ids):
                    ids = [build_ids[i], build_ids[i + 1], build_ids[i + 2]]
                    build_details = codebuild.batch_get_builds(ids=ids)["builds"]
                    build = get_relevant_build_info(build_details[0])
                    if build:
                        yield build
                    build = get_relevant_build_info(build_details[1])
                    if build:
                        yield build
                    build = get_relevant_build_info(build_details[2])
                    if build:
                        yield build
                elif i + 1 < len(build_ids):
                    ids = [build_ids[i], build_ids[i + 1]]
                    build_details = codebuild.batch_get_builds(ids=ids)["builds"]
                    build = get_relevant_build_info(build_details[0])
                    if build:
                        yield build
                    build = get_relevant_build_info(build_details[1])
                    if build:
                        yield build
                else:
                    ids = [build_ids[i]]
                    build_details = codebuild.batch_get_builds(ids=ids)["builds"]
                    build = get_relevant_build_info(build_details[0])
                    if build:
                        yield build
            if not next_token:
                break

    def create_build_info(build: Dict) -> Dict:
        return {
            "arn": _shortened_arn(build["arn"]),
            "project": project,
            "image_repo": image_repo,
            "image_tag": image_tag,
            "github": build.get("source", {}).get("location"),
            "branch": build.get("sourceVersion"),
            "commit": build.get("resolvedSourceVersion"),
            "number": build.get("buildNumber"),
            "initiator": _shortened_arn(build.get("initiator")),
            "status": build.get("buildStatus"),
            "success": build.get("buildStatus", "").upper() == "SUCCEEDED" or build["buildStatus"].upper() == "SUCCESS",
            "finished": build.get("buildComplete"),
            "started_at": datetime_string(build.get("startTime")),
            "finished_at": datetime_string(build.get("endTime")),
            "log_group": build.get("logs", {}).get("groupName"),
            "log_stream": build.get("logs", {}).get("streamName")
        }

    response = None
    for project in get_projects():
        for build in get_relevant_builds(project):
            if build:
                if not response:
                    response = {"latest": build}
                elif not response.get("previous"):
                    response["previous"] = build
                else:
                    response["next_previous"] = build
                    break
        if response and response.get("previous") and response.get("next_previous"):
            break
    return response
