import re
from typing import Optional


KNOWN_TASK_DEFINITION_OR_SERVICE_MAP = {re.compile(key, re.IGNORECASE): value for key, value in {
    r".*deploy.*initial.*": "deploy_initial",
    r".*deploy.*": "deploy",
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
