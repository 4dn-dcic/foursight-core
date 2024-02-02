import re
from typing import List, Optional
from .envs import Envs


KNOWN_TASK_DEFINITION_OR_SERVICE_MAP = {re.compile(key, re.IGNORECASE): value for key, value in {
    r"(.*deploy.*initial.*)|(.*initial.*deploy.*)": "deploy_initial",
    r"^(?!.*initial).*deploy.*$": "deploy",  # matches string containing 'deploy' but not 'initial'.
    r".*index.*": "indexer",
    r".*ingest.*": "ingester",
    r".*portal.*": "portal",
}.items()}.items()


def get_task_definition_type(task_definition_arn: str) -> Optional[str]:
    return _get_task_definition_or_service_type(task_definition_arn)


def get_service_type(service_arn: str) -> Optional[str]:
    return _get_task_definition_or_service_type(service_arn)


def _get_task_definition_or_service_type(task_definition_or_service_arn: str) -> Optional[str]:
    for pattern, task_definition_or_service_type in KNOWN_TASK_DEFINITION_OR_SERVICE_MAP:
        if pattern.match(task_definition_or_service_arn):
            return task_definition_or_service_type
    return None


def get_env_associated_with_cluster(cluster_arn: str, envs: Envs) -> Optional[dict]:
    if not isinstance(cluster_arn, str) or not isinstance(envs, Envs):
        return None
    return envs.get_associated_env(cluster_arn, for_cluster=True)


def get_cluster_associated_with_env(env: dict, envs: Envs, clusters: List[str]) -> Optional[str]:
    if not isinstance(env, dict) or not isinstance(envs, Envs) or not isinstance(clusters, list):
        return None
    is_env_staging = Envs._env_is_staging(env)
    is_env_data = Envs._env_is_data(env)
    if is_env_staging or is_env_data:
        # For (AWS ECS) clusters (and services), as opposed to task
        # definitions, staging is always blue and data is always green.
        for cluster_arn in clusters:
            if is_env_staging and Envs._value_is_blue(cluster_arn):
                return cluster_arn
            elif is_env_data and Envs._value_is_green(cluster_arn):
                return cluster_arn
    for cluster_arn in clusters:
        if envs._env_contained_within(env, cluster_arn):
            return cluster_arn
