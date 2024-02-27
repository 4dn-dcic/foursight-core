import boto3
import datetime
from functools import lru_cache
import pytz
import re
import time
from typing import Dict, List, Generator, Optional, Tuple, Union
from dcicutils.ecs_utils import ECSUtils
from .aws_ecs_tasks import (
    _get_cluster_arns, _get_task_running_id,
    _shortened_arn, _shortened_task_definition_arn
)
from .aws_ecs_types import get_env_associated_with_cluster, get_service_type
from ...app import app
from .datetime_utils import convert_datetime_to_utc_datetime_string as datetime_string
from .envs import Envs
from .misc_utils import name_value_list_to_dict, run_concurrently, run_functions_concurrently

# Functions to get AWS cluster and services info with the original
# end purpose of supporting redeploying Portal from the Foursight UI.

record_reindex_kickoff_via_tags = True


def get_aws_ecs_clusters_for_update(envs: Envs) -> List[Dict]:
    response = []
    for cluster_arn in _get_cluster_arns():
        cluster_env = get_env_associated_with_cluster(cluster_arn, envs=envs)
#       cluster_env = envs.get_associated_env(cluster_arn, for_cluster=True)
        if cluster_env:
            response.append({
                "cluster_arn": cluster_arn,
                "env": cluster_env
            })
    return response


def get_aws_ecs_services_for_update(envs: Envs, cluster_arn: str,
                                    include_image: bool = True,
                                    include_build: bool = True,
                                    include_build_digest: bool = False,
                                    previous_builds: int = 2,
                                    raw: bool = False) -> Union[Dict, List[Dict]]:
    """
    Returns the list of AWS services (for possible update purposes) within the given cluster (ARN).
    If all of the services have the same image, build, and environment info (which is typical/expected
    use case), then a dictionary is returned within which is the list of services, as well as the image,
    build, and environment info; otherwise a list is returned of the each service, within each of which
    is the associated image, build, and environment info. If a "sanity_check" boolean argument is passed
    in which is "true", then also included is the digest information for the build; this is not the default
    since to get it we have to go read the build logs; there is another function (get_aws_codebuild_digest)
    to get this specifically, so that (for example) this could be called asynchronously from a UI. Note
    that this digest information is not critical to the functioning of the Redeploy page; it is merely
    useful to sanity check the the image and associated build digest match.
    """

    def reorganize_response(services: Dict) -> Dict:
        if not services:
            return {}
        service = services[0]
        response = {
            "services": [],
            "env": service["env"]
        }
        if service.get("image"):
            response["image"] = service["image"]
        if service.get("build"):
            response["build"] = service["build"]
        for service in services:
            service.pop("image", None)
            service.pop("build", None)
            del service["env"]
            response["services"].append({**service})
        response["services"] = sorted(response["services"], key=lambda item: item["type"])
        return response

    def has_identical_metadata(service: Dict, previous_service: Dict) -> bool:
        return (service.get("build") == previous_service.get("build") and
                service.get("image") == previous_service.get("image") and
                service["env"] == previous_service["env"])

    identical_metadata = True
    previous_service = None

    services = _get_aws_ecs_services_for_update_raw(cluster_arn,
                                                    include_image=include_image,
                                                    include_build=include_build,
                                                    include_build_digest=include_build_digest,
                                                    previous_builds=previous_builds)

    # This "unknown services" code was added to handle for example cgap-devtest where there
    # was a sort of extraneous/unknown service called c4-ecs-cgap-devtest-qualys-private;
    # we really want to deal here, for redeploy purposes, with the known services, i.e. the
    # portal, indexer, ingester; these services are identified by _get_task_definition_type.

    unknown_services = [service for service in services if service.get("type_unknown", False)]
    services = [service for service in services if not service.get("type_unknown", False)]

    for service in services:
        service["env"] = envs.get_associated_env(service["task_definition_arn"])
        if previous_service and not has_identical_metadata(service, previous_service):
            identical_metadata = False
        previous_service = service

    if identical_metadata and not raw:
        services = reorganize_response(services)
        for unknown_service in unknown_services:
            if not services.get("unknown_services"):
                services["unknown_services"] = []
            services["unknown_services"].append(unknown_service)

    return services


def get_aws_codebuild_digest(log_group: str, log_stream: str, image_tag: Optional[str] = None) -> Optional[str]:
    logs = boto3.client("logs")
    sha256_pattern = re.compile(r"sha256:([0-9a-f]{64})")
    # For some reason this (rarely-ish) intermittently fails with no error;
    # the results just do not contain the digest; don't know why so try a few times.
    ntries = 7
    while ntries > 0:
        if ntries > 1:
            time.sleep(0.2)
        log_events = logs.get_log_events(logGroupName=log_group,
                                         logStreamName=log_stream, startFromHead=False)["events"]
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

    services = get_aws_ecs_services_for_update(app.core._envs, cluster_arn, include_image=False, include_build=False)

    def get_latest_build_info(cluster_arn: str) -> Optional[Tuple[str, str]]:
        try:
            build = get_aws_ecr_build_info(services["image"]["arn"], previous_builds=0)["latest"]
            return (build["github"], build["branch"], build["commit"])
        except Exception:
            return None

    ecs = ECSUtils()
    if record_reindex_kickoff_via_tags:
        full_cluster_arn = ecs.client.describe_clusters(clusters=[cluster_arn])["clusters"][0]["clusterArn"]
        if record_reindex_kickoff_via_tags:
            build_repo, build_branch, build_commit = get_latest_build_info(cluster_arn)
            tags = [
                {"key": "last_redeploy_kickoff_at", "value": datetime_string(datetime.datetime.now(pytz.UTC))},
                {"key": "last_redeploy_kickoff_by", "value": user or "unknown"},
                {"key": "last_redeploy_kickoff_repo", "value": build_repo or "unknown"},
                {"key": "last_redeploy_kickoff_commit", "value": build_commit or "unknown"},
                {"key": "last_redeploy_kickoff_branch", "value": build_branch or "unknown"}
            ]
        ecs.client.tag_resource(resourceArn=full_cluster_arn, tags=tags)

    # We do not call ecs.update_all_services because we want full control over what services
    # are actually restarted; namely only those that have been presented to the user in the UI.

    responses = []
    status = "OK"
    if services.get("services"):
        for service in services.get("services"):
            service_arn = service["full_arn"]
            try:
                # FYI: ecs.update_ecs_service does not return anything currently.
                ecs.update_ecs_service(cluster_name=cluster_arn, service_name=service_arn)
                responses.append({"cluster_arn": cluster_arn, "service_arn": service_arn})
            except Exception as e:
                status = "ERROR"
                responses.append({"cluster_arn": cluster_arn, "service_arn": service_arn, "exception": str(e)})
    
    return {"status": status, "services": responses}


def get_aws_ecs_cluster_status(cluster_arn: str) -> Optional[Dict]:

    ecs = boto3.client("ecs")

    if record_reindex_kickoff_via_tags:
        # We need the full cluster ARN to deal with (cluster) tags;
        # but we generally deal with the shortened version; so we get it
        # below within get_tasks_info as we don't want to make an extra call.
        full_cluster_arn = None

    def get_services_info() -> List[Dict]:
        return _get_aws_ecs_services_for_update_raw(cluster_arn,
                                                    include_image=False,
                                                    include_build=False,
                                                    include_build_digest=False,
                                                    previous_builds=0)

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
        tags = name_value_list_to_dict(tags, name_property_name="key", value_property_name="value")
        last_redeploy_kickoff_at = tags.get("last_redeploy_kickoff_at")
        last_redeploy_kickoff_by = tags.get("last_redeploy_kickoff_by")
        last_redeploy_kickoff_repo = tags.get("last_redeploy_kickoff_repo")
        last_redeploy_kickoff_branch = tags.get("last_redeploy_kickoff_branch")
        last_redeploy_kickoff_commit = tags.get("last_redeploy_kickoff_commit")
        if last_redeploy_kickoff_at:
            response["last_redeploy_kickoff_at"] = last_redeploy_kickoff_at
            if response["started_at"] and response["started_at"] < last_redeploy_kickoff_at:
                response["updating"] = True
        if last_redeploy_kickoff_by:
            response["last_redeploy_kickoff_by"] = last_redeploy_kickoff_by
        if last_redeploy_kickoff_repo:
            response["last_redeploy_kickoff_repo"] = last_redeploy_kickoff_repo
        if last_redeploy_kickoff_branch:
            response["last_redeploy_kickoff_branch"] = last_redeploy_kickoff_branch
        if last_redeploy_kickoff_commit:
            response["last_redeploy_kickoff_commit"] = last_redeploy_kickoff_commit
    return response


def get_aws_ecr_image_info(image_repo_or_arn: str, image_tag: Optional[str] = None) -> Dict:
    """
    Returns AWS ECR image info for the given image repo and tag.
    """
    if not image_tag:
        image_arn = image_repo_or_arn
        image_repo, image_tag = _get_image_repo_and_tag(image_arn)
    else:
        image_arn = None
        image_repo = image_repo_or_arn

    def create_image_info(image_repo: str, image_tag: str, image: Dict) -> Dict:
        return {
            "arn": image_arn,
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
                        image_info = create_image_info(image_repo, image_tag, image)
                        if not image_info["arn"]:
                            image_info["arn"] = repo.get("repositoryUri", "") + ":" + image_tag
                        return image_info
                if not next_token:
                    break
    return {}


def get_aws_ecr_build_info(image_repo_or_arn: str, image_tag: Optional[str] = None, previous_builds: int = 2) -> Dict:
    """
    Returns a dictionary with info about the three most recent CodeBuild builds
    for the given image repo and tag, or None if none found.
    """
    if not image_tag:
        image_repo, image_tag = _get_image_repo_and_tag(image_repo_or_arn)
    else:
        image_repo = image_repo_or_arn

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
                    "success": is_build_success(build),
                    "finished": build.get("buildComplete"),
                    "started_at": datetime_string(build.get("startTime")),
                    "finished_at": datetime_string(build.get("endTime")),
                    "log_group": build.get("logs", {}).get("groupName"),
                    "log_stream": build.get("logs", {}).get("streamName")
                }

            def is_build_success(build: Dict) -> bool:
                return build.get("buildStatus", "").upper() in ["SUCCEEDED", "SUCCESS"]

            def find_environment_variable(environment_variables: List[Dict], name: str) -> Optional[str]:
                value = [item["value"] for item in environment_variables if item["name"] == name]
                return value[0] if len(value) == 1 else None

            if build and is_build_success(build):
                environment_variables = build.get("environment", {}).get("environmentVariables", {})
                build_image_repo = find_environment_variable(environment_variables, "IMAGE_REPO_NAME")
                build_image_tag = find_environment_variable(environment_variables, "IMAGE_TAG")
                if build_image_repo == image_repo and build_image_tag == image_tag:
                    return create_build_info(build)
            return None

        get_builds_from_boto_this_many_at_a_time = 4
        next_token = None
        while True:
            if next_token:
                build_ids = codebuild.list_builds_for_project(projectName=project, nextToken=next_token)
            else:
                build_ids = codebuild.list_builds_for_project(projectName=project, sortOrder="DESCENDING")
            next_token = build_ids.get("nextToken")
            build_ids = build_ids["ids"]
            while build_ids:
                build_ids_batch = build_ids[:get_builds_from_boto_this_many_at_a_time]
                build_ids = build_ids[get_builds_from_boto_this_many_at_a_time:]
                builds = codebuild.batch_get_builds(ids=build_ids_batch)["builds"]
                for build in builds:
                    build = get_relevant_build_info(build)
                    if build:
                        yield build
            if not next_token:
                break

    number_of_previous_builds_to_return = previous_builds
    response = {}
    for project in get_projects():
        for build in get_relevant_builds(project):
            if not response.get("latest"):
                response["latest"] = build
            else:
                if not response.get("others"):
                    response["others"] = []
                response["others"].append(build)
            if number_of_previous_builds_to_return <= 0:
                break
            number_of_previous_builds_to_return -= 1
        if number_of_previous_builds_to_return <= 0:
            break

    return response


def _get_aws_ecs_services_for_update_raw(cluster_arn: str,
                                         include_image: bool,
                                         include_build: bool,
                                         include_build_digest: bool,
                                         previous_builds: int) -> List[Dict]:

    ecs = boto3.client("ecs")

    def get_service_info(service_arn: str) -> Dict:

        def shortened_service_arn(service_arn: str, cluster_arn: str) -> str:
            service_arn = _shortened_arn(service_arn)
            if service_arn.startswith(f"{cluster_arn}/"):
                service_arn = service_arn.replace(f"{cluster_arn}/", "")
            return service_arn

        response = {}
        full_service_arn = service_arn
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
            service_type = get_service_type(service_arn)
            response = {
                "arn": service_arn,
                "full_arn": full_service_arn,
                "type": service_type or service_arn,
                "task_definition_arn": task_definition_arn,
                "tasks_running_count": tasks_running_count,
                "tasks_pending_count": tasks_pending_count,
                "tasks_desired_count": tasks_desired_count,
                "updating": tasks_pending_count > 0 or tasks_desired_count != tasks_running_count
            }
            if (mirror := Envs.is_blue_green_mirror_state(service_arn, task_definition_arn)) is True:
                response["is_blue_green_mirror"] = True
            elif mirror is False:
                response["is_blue_green_normal"] = True
            if not service_type:
                response["type_unknown"] = True
            response["image"] = {"arn": container_definition["image"]}
            if has_multiple_containers:
                response["warning_has_multiple_containers"] = True
        return response

    @lru_cache
    def get_image_info(image_repo: str, image_tag: str) -> Optional[Dict]:
        # Cache this result within the enclosing function; for the below services loop.
        return get_aws_ecr_image_info(image_repo, image_tag)

    @lru_cache
    def get_build_info(image_repo: str, image_tag: str) -> Optional[Dict]:
        # Cache this result within the enclosing function; for the below services loop.
        build = get_aws_ecr_build_info(image_repo, image_tag, previous_builds=previous_builds)
        if include_build_digest:
            log_group = build.get("latest", {}).get("log_group")
            log_stream = build.get("latest", {}).get("log_stream")
            build["latest"]["digest"] = get_build_digest(log_group, log_stream, image_tag)
        return build

    @lru_cache
    def get_build_digest(log_group: str, log_stream: str, image_tag: Optional[str] = None) -> Optional[str]:
        # Cache this result within the enclosing function; for the below services loop.
        return get_aws_codebuild_digest(log_group, log_stream, image_tag)

    service_arns = ecs.list_services(cluster=cluster_arn).get("serviceArns", [])
    # For better performance we get each service info in parallel.
    # But, since, typically, the image/build info for each service will be exactly the same,
    # we don't include the retrieval of these in the concurrently executed code since we will,
    # typically, only need a single call to get this image/biuld info anyways; and including the
    # retrieval of this would mess up the concurrency of the local caching of this image/build info.
    # Also get the image and build info concurrently relative to each other.
    services = [service for service in run_concurrently(get_service_info, service_arns)]
    # Now get the image/build info for each service; concurrently for performance only.
    if include_image or include_build:
        for service in services:
            image_repo, image_tag = _get_image_repo_and_tag(service["image"]["arn"])
            info = run_functions_concurrently([
                (lambda: get_image_info(image_repo, image_tag)) if include_image else None,
                (lambda: get_build_info(image_repo, image_tag)) if include_build else None
            ])
            service["image"] = {**service["image"], **(info[0] or {})}
            service["build"] = info[1]
    return services


def _get_image_repo_and_tag(image_arn: str) -> Tuple[Optional[str], Optional[str]]:
    image_arn = _shortened_arn(image_arn)
    parts = image_arn.split(":")
    return (parts[0], parts[1]) if len(parts) == 2 else (None, None)
