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
    GLOBAL_APPLICATION_CONFIGURATION,
    SecretsTable,
)


logging.basicConfig()
logger = logging.getLogger(__name__)


def apply_identity_globally():

    # This maps key names in the global application configuration (GAC) to names used here.
    IDENTITY_KEY_MAP = {
        "ENCODED_AUTH0_CLIENT": "CLIENT_ID",
        "ENCODED_AUTH0_SECRET": "CLIENT_SECRET",
        "ENCODED_S3_ENCRYPT_KEY_ID": "S3_ENCRYPT_KEY_ID",
        "ENCODED_ES_SERVER": "ES_HOST",
    }

    # Make sure the IDENTITY (environment variable) is set (via Foursight CloudFormation template);
    # this is the name of the global application configuration (GAC) secret.
    identity_name = get_identity_name(identity_kind=GLOBAL_APPLICATION_CONFIGURATION)
    if not identity_name:
        raise Exception("Foursight {GLOBAL_APPLICATION_CONFIGURATION} environment variable not set!")
    logger.info(f"Foursight {GLOBAL_APPLICATION_CONFIGURATION} environment variable value is: {identity_name}")

    # Make sure the STACK_NAME (environment variable) is set (via Foursight CloudFormation template);
    # from this we are able to find the CHECK_RUNNER lambda function name.
    stack_name = os.environ.get("STACK_NAME")
    if not stack_name:
        raise Exception("Foursight STACK_NAME environment variable not set!")
    logger.info(f"Foursight STACK_NAME environment variable value is: {stack_name}")

    # Apply the GAC secrets values globally to os.environ.
    apply_identity(identity_kind=GLOBAL_APPLICATION_CONFIGURATION, rename_keys=IDENTITY_KEY_MAP)

    # Get RDS_NAME from the GAC. But just added this recently (late July 2022), so to avoid
    # issues with release timing, at least for testing period, if it is not set then get it
    # from the RDS secrets. Temporary hack. TODO: Remove when fully tested and ready to go.
    rds_name = os.environ.get("RDS_NAME")
    if not rds_name:
        rds_secrets_name = identity_name.replace("ApplicationConfiguration", "RDSSecret")
        rds_secrets = SecretsTable(rds_secrets_name)
        os.environ["RDS_NAME"] = rds_secrets.get("dbInstanceIdentifier")

    # Get the CHECK_RUNNER lambda function name; using the stack_name as a prefix; for example,
    # this lambda name looks like: c4-foursight-cgap-supertest-stack-CheckRunner-pKsOvziDT7QI
    # where c4-foursight-cgap-supertest-stack is the stack_name.
    check_runner_lambda_function_name_pattern = stack_name + "-CheckRunner-.*"
    check_runner_lambda_function_names = (
        AbstractOrchestrationManager.find_lambda_function_names(check_runner_lambda_function_name_pattern))
    if not check_runner_lambda_function_names:
        raise Exception("Foursight CheckRunner lambda not found: {check_runner_lambda_function_name_pattern}")
    elif len(check_runner_lambda_function_names) != 1:
        raise Exception("Unique Foursight CheckRunner lambda not found: {check_runner_lambda_function_name_pattern}")
    os.environ["CHECK_RUNNER"] = check_runner_lambda_function_names[0]
    logger.info(f"Foursight CHECK_RUNNER environment variable value is: {os.environ['CHECK_RUNNER']}")

    # Set ES_HOST to proxy for local testing (e.g. http://localhost:9200) via ES_HOST_LOCAL environment variable.
    es_host_local = os.environ.get("ES_HOST_LOCAL")
    if es_host_local:
        os.environ["ES_HOST"] = es_host_local
        logger.info(f"Foursight ES_HOST local environment variable value is: {os.environ.get('ES_HOST')}")
    else:
        logger.info(f"Foursight ES_HOST environment variable value is: {os.environ.get('ES_HOST')}")
