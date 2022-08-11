# dmichaels/2022-07-20/C4-826:
# New module/function to get and apply the IDENTITY values globally to the os.environ from
# the global application configuration (GAC). Map any GAC key name changes to the key name
# values used here within Foursight. These values were previously hardcoded as environment
# variables in the Foursight CloudFormation template. Will count on getting these values:
#
# GAC Key Name               Foursight Key Name
# ------------               -------------------
# ENCODED_AUTH0_CLIENT       -> CLIENT_ID
# ENCODED_AUTH0_SECRET       -> CLIENT_SECRET
# ENV_NAME                   -> ENV_NAME
# ENCODED_ES_SERVER          -> ES_HOST
# RDS_NAME                   -> RDS_NAME
# S3_ENCRYPT_KEY             -> S3_ENCRYPT_KEY
# ENCODED_S3_ENCRYPT_KEY_ID  -> S3_ENCRYPT_KEY_ID
#
# Note that RDS_NAME is new to the GAC (late July 2022, from RDS application secrets).

import logging
import os
from dcicutils.cloudformation_utils import AbstractOrchestrationManager
from dcicutils.secrets_utils import (
    apply_identity,
    get_identity_name,
    GLOBAL_APPLICATION_CONFIGURATION
)


logging.basicConfig()
logger = logging.getLogger(__name__)


def find_lambda_names(stack_name: str, lambda_name_pattern: str) -> list:
    """
    Returns list of lambda function names for the given stack name and containing the given pattern.
    This takes into account the fact that chalice MAY have TRUNCATED the stack name portion of the
    lambda function name we are looking for. So the lambda function name we look for is the one
    containing the given pattern AND which starts with (up until the given pattern) a string
    which either matches the stack name or is a substring of the stack name.

    For example, if the the stack name is "c4-foursight-fourfront-production-stack" and there exists
    a lambda function named "c4-foursight-fourfront-production-stac-CheckRunner-MW4VHuCIsDXc" then
    we will match this even though the "c4-foursight-fourfront-production-stack" stack name prefix
    was truncated (by one character) to "c4-foursight-fourfront-production-stac" in the lambda name.

    :param stack_name: Stack name which is a prefix of the lambda name to find.
    :param lambda_name_pattern: Substring which the lambda function name must contain.
    :return: List of zero or more matching names.
    """
    response = []
    lambda_name_regex = f".*{lambda_name_pattern}.*"
    lambda_names = AbstractOrchestrationManager.find_lambda_function_names(lambda_name_regex)
    for lambda_name in lambda_names:
        lambda_name_prefix_end_index = lambda_name.index(lambda_name_pattern)
        lambda_name_prefix = lambda_name[:lambda_name_prefix_end_index]
        if stack_name.startswith(lambda_name_prefix):
            response.append(lambda_name)
    return response


def find_check_runner_lambda_name(stack_name: str) -> str:
    """
    Returns name of the CheckRunner lambda function for the given stack name.
    Raises exception if not found or if a unique name is not found.

    :param stack_name: Stack name which is a prefix of the lambda name to find.
    :return: Lambda name of the CheckRunner lamba for the given stack name. Exception if not found or not unique.
    """
    check_runner_lambda_name_pattern = "-CheckRunner-"
    check_runner_lambda_names = find_lambda_names(stack_name, check_runner_lambda_name_pattern)
    if not check_runner_lambda_names:
        raise Exception(f"Foursight CheckRunner lambda (containing: {check_runner_lambda_name_pattern}) not found.")
    elif len(check_runner_lambda_names) != 1:
        raise Exception(f"Unique Foursight CheckRunner lambda (containing: {check_runner_lambda_name_pattern})"
                        f" not found: {len(check_runner_lambda_names)} matches")
    return check_runner_lambda_names[0]


def apply_identity_globally():

    # This maps key names in the global application configuration (GAC) to names used here.
    IDENTITY_KEY_MAP_REQUIRED = {
        "ENCODED_AUTH0_CLIENT": "CLIENT_ID",
        "ENCODED_AUTH0_SECRET": "CLIENT_SECRET",
        "ENCODED_ES_SERVER": "ES_HOST",
    }
    IDENTITY_KEY_MAP_NOT_REQUIRED = {
        "ENCODED_S3_ENCRYPT_KEY_ID": "S3_ENCRYPT_KEY_ID"
    }

    # Make sure the IDENTITY (environment variable) is set (via Foursight CloudFormation template);
    # this is the name of the global application configuration (GAC) secret.
    identity_name = get_identity_name(identity_kind=GLOBAL_APPLICATION_CONFIGURATION)
    if not identity_name:
        raise Exception(f"Foursight {GLOBAL_APPLICATION_CONFIGURATION} environment variable not set!")
    logger.info(f"Foursight {GLOBAL_APPLICATION_CONFIGURATION} environment variable value is: {identity_name}")

    # Make sure the STACK_NAME (environment variable) is set (via Foursight CloudFormation template);
    # from this we are able to find the CHECK_RUNNER lambda function name.
    stack_name = os.environ.get("STACK_NAME")
    if not stack_name:
        raise Exception(f"Foursight STACK_NAME environment variable not set!")
    logger.info(f"Foursight STACK_NAME environment variable value is: {stack_name}")

    # Apply the GAC secrets values globally to os.environ.
    # First do the required ones and then the non-required ones;
    # like this because apply_identity will throw an exception of the given key name does not exist.
    # Could enhance apply_identity to handle this optional-key scenario, but for now just do it like this.
    apply_identity(identity_kind=GLOBAL_APPLICATION_CONFIGURATION, rename_keys=IDENTITY_KEY_MAP_REQUIRED)
    try:
        apply_identity(identity_kind=GLOBAL_APPLICATION_CONFIGURATION, rename_keys=IDENTITY_KEY_MAP_NOT_REQUIRED)
    except (KeyError, ValueError):
        pass

    # Note that we will assume RDS_NAME is in the GAC.
    # Previously it was (and still is) in the RDSSecret (as dbInstanceIdentifier)
    # but we added it (as RDS_NAME) to the GAC (circa August 2022).
    rds_name = os.environ.get("RDS_NAME")
    if rds_name:
        logger.info(f"Foursight RDS_NAME environment variable value is: {rds_name}")
    else:
        logger.info(f"Foursight RDS_NAME environment variable is not set.")

    # Get the CHECK_RUNNER lambda function name; using the stack_name as a prefix; for example,
    # this lambda name looks like: c4-foursight-cgap-supertest-stack-CheckRunner-pKsOvziDT7QI
    # where c4-foursight-cgap-supertest-stack is the stack_name. See find_check_runner_lambda_name
    # above which hides handling of details related to the fact that chalice may have truncated
    # the stack name (prefix) portion of the lambda function name.
    os.environ["CHECK_RUNNER"] = find_check_runner_lambda_name(stack_name)
    logger.info(f"Foursight CHECK_RUNNER environment variable value is: {os.environ['CHECK_RUNNER']}")

    # Set ES_HOST to proxy for local testing (e.g. http://localhost:9200) via ES_HOST_LOCAL environment variable.
    es_host_local = os.environ.get("ES_HOST_LOCAL")
    if es_host_local:
        os.environ["ES_HOST"] = es_host_local
        logger.info(f"Foursight ES_HOST local environment variable value is: {os.environ.get('ES_HOST')}")
    else:
        logger.info(f"Foursight ES_HOST environment variable value is: {os.environ.get('ES_HOST')}")
