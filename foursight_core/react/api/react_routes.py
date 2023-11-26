from chalice import Response
import urllib.parse
from dcicutils.misc_utils import ignored
from ...app import app
from .react_route_decorator import route, route_root


class ReactRoutes:

    def __init__(self):
        super(ReactRoutes, self).__init__()

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes UNPROTECTED by authorization/authentication.
    # ----------------------------------------------------------------------------------------------

    @route("/{env}/auth0_config", authorize=False, define_noenv_route=True)
    def reactapi_route_auth0_config(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns Auth0 configuration for authentication (from Portal).
        Note that this in an UNPROTECTED route.
        """
        ignored(env)
        return app.core.reactapi_auth0_config(app.request())

    @route("/cognito_config", authorize=False)
    def reactapi_route_cognito_config() -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns AWS Cognito configuration for authentication; from environment variables or Secrets Manager;
        getting from one or the other happens in cognito.get_cognito_oauth_config.
        Note that this in an UNPROTECTED route.
        """
        return app.core.reactapi_cognito_config(app.request())

    @route("/cognito/callback", authorize=False)
    def reactapi_route_cognito_callback() -> Response:  # noqa: implicit @staticmethod via @route
        # API version of reactapi_route_cognito_callback.
        """
        Secondary AWS Cognito OAuth callback; called from our primary frontend callback which is
        redirected to from Cognito so it can pick up the ouath_pkce_key (sic) which is written to
        browser session storage by the React authentication kickoff code (Amplify.federatedSignIn).
        Note that this in an UNPROTECTED route.
        """
        return app.core.reactapi_cognito_callback(app.request())

    @route("/{env}/logout", authorize=False, define_noenv_route=True)
    def reactapi_route_logout(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Logs out the user. Sends back specific message if already logged out, or not.
        The env is not strictly required for logout, since we logout from all environments,
        but it is is useful for the redirect back, and also just for consistency/completeness.
        """
        return app.core.reactapi_logout(app.request(), env)

    @route("/{env}/header", authorize=False, define_noenv_route=True)
    def reactapi_route_header(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Returns minimal data for React UI to get up and running.
        """
        return app.core.reactapi_header(app.request(), env)

    @route("/{env}/certificates", authorize=False, define_noenv_route=True)
    def reactapi_route_certificates(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Returns SSL certificate info about this Foursight instance and its associated Portal instance.
        """
        ignored(env)
        return app.core.reactapi_certificates(app.request(), app.request_args())

    @route("/{env}/portal_access_key", authorize=False, define_noenv_route=True)
    def reactapi_route_portal_access_key(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Returns Portal access key info about this Foursight instance.
        """
        ignored(env)
        return app.core.reactapi_portal_access_key(app.request(), app.request_args())

    @route("/{env}/elasticsearch", authorize=False, define_noenv_route=True)
    def reactapi_route_elasticsearch(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Pings the Elasticsearch associated with this Foursight instance and returns related info.
        """
        ignored(env)
        return app.core.reactapi_elasticsearch()

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes PROTECTED by authorization/authentication.
    # ----------------------------------------------------------------------------------------------

    @route("/{env}/info", authorize=True)
    def reactapi_route_info(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns sundry info about the app.
        """
        return app.core.reactapi_info(app.request(), env)

    @route("/{env}/ecosystems", authorize=True, define_noenv_route=True)
    def reactapi_route_ecosystems(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns sundry info about the ecosystems.
        """
        return app.core.reactapi_ecosystems(app.request(), env)

    @route("/{env}/users", methods=["GET", "POST"], authorize=True)
    def reactapi_route_users_get_or_post(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        GET:  Returns the (paged) list of all defined users.
              Optional arguments (args) for the request are any of:
              - search: to search for the specified value.
              - limit: to limit the results to the specified number.
              - offset: to skip past the first specified number of results.
              - sort: to sort by the specified field name (optionally suffixed with .asc which is default or .desc);
                      default is email.asc.
              - raw: if true then returns the raw format of the data.
        POST: Creates a new user described by the given data;
              must contain: email, first_name, last_name.

        Note that you cannot have more than one route with the same path even
        if the methods are different; rather you must bundle them together and
        distinguish between which method is used programmatically as we do here.
        """
        if app.request_method() == "GET":
            return app.core.reactapi_get_users(app.request(), env, app.request_args())
        elif app.request_method() == "POST":
            return app.core.reactapi_post_user(app.request(), env, user=app.request_args())
        else:
            return app.core.create_forbidden_response()

    @route("/{env}/users/{uuid}", methods=["GET", "PATCH", "DELETE"], authorize=True)
    def reactapi_route_user_get_or_patch_or_delete(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        GET:    Returns detailed info for the user identified by the given uuid (may also be email).
                Optional arguments (args) for the request are any of:
                - raw: if true then returns the raw format of the data.
        PATCH:  Updates the user identified by the given uuid with the given user data;
                must contain: email, first_name, last_name.
        DELETE: Deletes the user identified by the given uuid.

        Note that you cannot have more than one route with the same path even
        if the methods are different; rather you must bundle them together and
        distinguish between which method is used programmatically as we do here.
        """
        if app.request_method() == "GET":
            return app.core.reactapi_get_user(app.request(), env, uuid, app.request_args())
        elif app.request_method() == "PATCH":
            return app.core.reactapi_patch_user(app.request(), env, uuid=uuid, user=app.request_body())
        elif app.request_method() == "DELETE":
            return app.core.reactapi_delete_user(app.request(), env, uuid=uuid)
        else:
            return app.core.create_forbidden_response()

    @route("/{env}/users/institutions", authorize=True)
    def reactapi_route_users_institutions(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user insitutions.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_users_institutions(app.request(), env, app.request_args())

    @route("/{env}/users/projects", authorize=True)
    def reactapi_route_users_projects(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user projects.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_users_projects(app.request(), env, app.request_args())

    @route("/{env}/users/awards", authorize=True)
    def reactapi_route_users_awards(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user awards.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_users_awards(app.request(), env, app.request_args())

    @route("/{env}/users/labs", authorize=True)
    def reactapi_route_users_labs(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user labs.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_users_labs(app.request(), env, app.request_args())

    @route("/{env}/users/consortia", authorize=True)
    def reactapi_route_users_consortia(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user consortia.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_users_consortia(app.request(), env, app.request_args())

    @route("/{env}/users/submission_centers", authorize=True)
    def reactapi_route_users_submission_centers(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user submission_centers.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_users_submission_centers(app.request(), env, app.request_args())

    @route("/{env}/users/roles", authorize=True)
    def reactapi_route_users_roles(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user roles.
        """
        return app.core.reactapi_users_roles(app.request(), env)

    @route("/{env}/users/schema", authorize=True)
    def reactapi_route_users_schema(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the user schema (JSON) from ElasticSearch.
        """
        return app.core.reactapi_users_schema(app.request(), env)

    @route("/{env}/users/statuses", authorize=True)
    def reactapi_route_users_statuses(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the possible user status.
        """
        return app.core.reactapi_users_statuses(app.request(), env)

    @route("/{env}/checks", authorize=True)
    def reactapi_route_checks_ungrouped(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on all defined checks, NOT grouped by check group, as dictionary
        where each key name is the check name and its object contents contain the check details.
        For troubleshooting only.
        """
        return app.core.reactapi_checks_ungrouped(app.request(), env)

    @route("/{env}/checks/grouped", authorize=True)
    def reactapi_route_checks_grouped(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on all defined checks, grouped by check group, as a list where
        each item is an object containing the group name and list of check detail objects.
        """
        return app.core.reactapi_checks_grouped(app.request(), env)

    @route("/{env}/checks/grouped/schedule", authorize=True)
    def reactapi_route_checks_grouped_by_schedule(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on all defined checks, grouped by check group, as a list where each
        each item is an object containing the schedule namei and list list of check detail objecs.
        """
        return app.core.reactapi_checks_grouped_by_schedule(app.request(), env)

    @route("/{env}/checks/{check}", authorize=True)
    def reactapi_route_checks_check(env: str, check: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the details of the given named checke as a dicitonary.
        """
        return app.core.reactapi_checks_check(app.request(), env, check=check)

    @route("/{env}/checks/{check}/history", authorize=True)
    def reactapi_route_checks_history(env: str, check: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on the run histories of the given check (paged).
        Optional arguments (args) for the request are any of:
        - limit: to limit the results to the specified number.
        - offset: to skip past the first specified number of results.
        - sort: to sort by the specified field name (optionally suffixed with .asc which is default or .desc);
                default value is timestamp.desc.
        """
        return app.core.reactapi_checks_history(app.request(), env, check=check, args=app.request_args())

    @route("/{env}/checks/{check}/history/latest", authorize=True)
    def reactapi_route_checks_history_latest(env: str, check: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the latest (most recent) run result for the given check.
        """
        return app.core.reactapi_checks_history_latest(app.request(), env, check=check)

    @route("/{env}/checks/{check}/history/{uuid}", authorize=True)
    def reactapi_route_checks_history_uuid(env: str, check: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the result of the given check result by its (name and) uuid.
        """
        return app.core.reactapi_checks_history_uuid(app.request(), env, check=check, uuid=uuid)

    @route("/{env}/checks/history/recent", authorize=True)
    def reactapi_route_checks_history_recent(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns all "recent" check run history, across all checks.
        Paging is NOT currently supported, though the number of results can be limited
        via the limit argument, the default of which is 25; sorted by timestamp descending.
        Optional arguments (args) for the request are any of:
        - limit: to limit the results to the specified number; default is 25;
                 no additionl paging related functionality is currently supported.
        """
        return app.core.reactapi_checks_history_recent(app.request(), env, args=app.request_args())

    @route("/{env}/checks/{check}/run", authorize=True)
    def reactapi_route_checks_run(env: str, check: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Kicks off a run of the given check.
        Arguments (args) for the request are any of:
        - args: Base-64 encode JSON object containing fields/values appropriate for the check run.
        """
        return app.core.reactapi_checks_run(app.request(), env, check=check, args=app.request_arg("args"))

    @route("/{env}/action/{action}/run", authorize=True)
    def reactapi_route_action_run(env: str, action: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Kicks off a run of the given check.
        Arguments (args) for the request are any of:
        - args: Base-64 encode JSON object containing fields/values appropriate for the action run.
        """
        return app.core.reactapi_action_run(app.request(), env, action=action, args=app.request_arg("args"))

    @route("/{env}/checks_status", authorize=True)
    def reactapi_route_checks_status(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on currently running/queueued checks.
        """
        return app.core.reactapi_checks_status(app.request(), env)

    @route("/{env}/checks_raw", authorize=True)
    def reactapi_route_checks_raw(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the contents of the raw check_setup.json file.
        """
        return app.core.reactapi_checks_raw(app.request(), env)

    @route("/{env}/checks_registry", authorize=True)
    def reactapi_route_checks_registry(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed registered checks functions.
        """
        return app.core.reactapi_checks_registry(app.request(), env)

    @route("/{env}/checks_validation", authorize=True)
    def reactapi_route_checks_validation(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns information about any problems with the checks setup.
        """
        return app.core.reactapi_checks_validation(app.request(), env)

    @route("/{env}/lambdas", authorize=True)
    def reactapi_route_lambdas(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on defined lambdas.
        """
        return app.core.reactapi_lambdas(app.request(), env)

    @route("/{env}/gac/{env_compare}", authorize=True)
    def reactapi_route_gac_compare(env: str, env_compare: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Compares and returns diffs for values in the given two GACs.
        """
        return app.core.reactapi_gac_compare(app.request(), env, env_compare=env_compare)

    @route("/{env}/aws/s3/buckets", authorize=True)
    def reactapi_route_aws_s3_buckets(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets(app.request(), env)

    @route("/{env}/aws/s3/buckets/{bucket}", authorize=True)
    def reactapi_route_aws_s3_buckets_keys(env: str, bucket: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets_keys(app.request(), env, bucket=bucket)

    @route("/{env}/aws/s3/buckets/{bucket}/{key}", authorize=True)
    def reactapi_route_aws_s3_buckets_key_contents(env: str, bucket: str, key: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets_key_contents(app.request(), env, bucket=bucket, key=key)

    @route("/{env}/accounts", authorize=True)
    def reactapi_route_accounts(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on known accounts/environments as defined in an accounts.json file if present.
        """
        return app.core.reactapi_accounts(app.request(), env)

    @route("/{env}/accounts/{name}", authorize=True)
    def reactapi_route_account(env: str, name: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on known accounts/environments as defined in an accounts.json file if present.
        Here are the pertinent data points returns by this endpoint, none of them secret:
        - Various version info (Python packages, Elasticsearch)
        - Foursight URL
        - Foursight deployed timestamp
        - Foursight stage name
        - Foursight current/default environment name (not all known environments but a count of them)
        - Global application configuration name i.e. identity (also in Portal health URL output)
        - S3 global environment bucket name
        - S3 Bucket organization name
        - AWS account ID and alias
        - S3 encryption ID (also in Portal health URL output)
        - Auth0 Client ID
        - reCAPTCHA ID
        - Elasticsearch hostname
        - RDS database hostname
        - Portal URL
        - Portal deployed timestamp
        - Portal health URL output (verbatim)
        """
        return app.core.reactapi_account(app.request(), env, name)

    @route("/{env}/aws/vpcs", authorize=True)
    def reactapi_route_aws_vpcs(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS VPCs.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_vpcs(app.request(), env, args=app.request_args())

    @route("/{env}/aws/vpcs/{vpc}", authorize=True)
    def reactapi_route_aws_vpc(env: str, vpc: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS VPC for the given VPC ID..
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_vpcs(app.request(), env, vpc, args=app.request_args())

    @route("/{env}/aws/subnets", authorize=True)
    def reactapi_route_aws_subnets(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Subnets.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_subnets(app.request(), env, args=app.request_args())

    @route("/{env}/aws/subnets/{subnet}", authorize=True)
    def reactapi_route_aws_subnet(env: str, subnet: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Subnet.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_subnets(app.request(), env, subnet, args=app.request_args())

    @route("/{env}/aws/security_groups", authorize=True)
    def reactapi_route_aws_security_groups(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Security Groups.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_security_groups(app.request(), env, args=app.request_args())

    @route("/{env}/aws/security_groups/{security_group}", authorize=True)
    def reactapi_route_aws_security_group(env: str, security_group: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Security Group.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_security_groups(app.request(), env, security_group, args=app.request_args())

    @route("/{env}/aws/security_group_rules/{security_group}", authorize=True)
    def reactapi_route_aws_security_group(env: str, security_group: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Security Group Rules.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_security_group_rules(app.request(), env, security_group, args=app.request_args())

    @route("/{env}/aws/network", authorize=True)
    def reactapi_route_aws_network(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS VPCs, Subnets, and Security Groups, grouped by VPC.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_network(app.request(), env, args=app.request_args())

    @route("/{env}/aws/network/{network}", authorize=True)
    def reactapi_route_aws_network(env: str, network: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS VPCs, Subnets, and Security Groups, grouped by VPC.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        return app.core.reactapi_aws_network(app.request(), env, network, args=app.request_args())

    @route("/{env}/aws/stacks", authorize=True)
    def reactapi_route_aws_stacks(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Stacks.
        """
        return app.core.reactapi_aws_stacks(app.request(), env)

    @route("/{env}/aws/stacks/{stack}", authorize=True)
    def reactapi_route_aws_stack(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack(app.request(), env, stack)

    @route("/{env}/aws/stacks/{stack}/outputs", authorize=True)
    def reactapi_route_aws_stack_outputs(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns outputs for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack_outputs(app.request(), env, stack)

    @route("/{env}/aws/stacks/{stack}/parameters", authorize=True)
    def reactapi_route_aws_stack_parameters(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns parameters for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack_parameters(app.request(), env, stack)

    @route("/{env}/aws/stacks/{stack}/resources", authorize=True)
    def reactapi_route_aws_stack_resources(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns resources for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack_resources(app.request(), env, stack)

    @route("/{env}/aws/stacks/{stack}/template", authorize=True)
    def reactapi_route_aws_stack_template(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns template (as a string) for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack_template(app.request(), env, stack)

    @route("/__functioncache__", authorize=True)
    def reactapi_route_function_cache() -> Response:  # noqa: implicit @staticmethod via @route
        """
        For troubleshooting only. Returns function cache info.
        """
        return app.core.reactapi_function_cache(app.request())

    @route("/__functioncacheclear__", authorize=True)
    def reactapi_route_function_cache() -> Response:  # noqa: implicit @staticmethod via @route
        """
        For troubleshooting only. Clears function cache.
        """
        return app.core.reactapi_function_cache_clear(app.request(), app.request_args())

    @route("/__reloadlambda__", authorize=True)
    def reactapi_route_reload_lambda() -> Response:  # noqa: implicit @staticmethod via @route
        """
        For troubleshooting only. Reload the lambda code.
        """
        return app.core.reactapi_reload_lambda(app.request())

    @route("/__testsize__/{n}", authorize=True)
    def reactapi_route_testsize(n: int) -> Response:  # noqa: implicit @staticmethod via @route
        """
        For troubleshooting only. Test response size capabilities of AWS Lamdas.
        """
        return app.core.reactapi_testsize(n)

    @route("/{env}/accounts_file", methods=["POST"], authorize=True, define_noenv_route=True)
    def reactapi_route_accounts_file_upload(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        ignored(env)
        return app.core.reactapi_accounts_file_upload(app.request_body())

    @route("/{env}/accounts_file", authorize=True, define_noenv_route=True)
    def reactapi_route_accounts_file_download(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        ignored(env)
        return app.core.reactapi_accounts_file_download()

    @route("/{env}/aws/secrets/{secrets_name}", authorize=True, define_noenv_route=True)
    def reactapi_route_aws_secrets(env: str, secrets_name: str) -> Response:  # noqa: implicit @staticmethod via @route
        ignored(env)
        return app.core.reactapi_aws_secrets(secrets_name)

    @route("/{env}/aws/secrets", authorize=True, define_noenv_route=True)
    def reactapi_route_aws_secret_names(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        ignored(env)
        return app.core.reactapi_aws_secret_names()

    @route("/aws/ecs/clusters", authorize=True)
    def reactapi_route_aws_ecs_clusters() -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_aws_ecs_clusters()

    @route("/aws/ecs/clusters/{cluster_arn}", authorize=True)
    def reactapi_route_aws_ecs_cluster(cluster_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_aws_ecs_cluster(cluster_arn=cluster_arn)

    @route("/aws/ecs/tasks", authorize=True)
    def reactapi_route_aws_ecs_tasks() -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_aws_ecs_task_arns(latest=False)

    @route("/aws/ecs/tasks/{task_definition_arn}", methods=["GET", "POST"], authorize=True)
    def reactapi_route_aws_ecs_task(task_definition_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        if app.request_method() == "GET":
            if task_definition_arn.lower() == "latest":
                return app.core.reactapi_aws_ecs_task_arns(latest=True)
            elif task_definition_arn.lower() == "details":
                return app.core.reactapi_aws_ecs_tasks(latest=False)
            else:
                return app.core.reactapi_aws_ecs_task(task_definition_arn)
        elif app.request_method() == "POST":
            if task_definition_arn.lower() == "run":
                # TODO: This is not fully baked.
                return app.core.reactapi_aws_ecs_task_run(task_definition_arn)
        return app.core.create_forbidden_response()

    @route("/aws/ecs/tasks_for_running/{task_name}", authorize=True)
    def reactapi_route_aws_ecs_tasks_for_runing(task_name: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_tasks import get_aws_ecs_tasks_for_running
        return get_aws_ecs_tasks_for_running(app.core._envs, task_definition_type=task_name)

    @route("/aws/ecs/task_running/{cluster_arn}/{task_definition_arn}", authorize=True)
    def reactapi_route_aws_ecs_task_running(cluster_arn: str, task_definition_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_tasks import get_aws_ecs_task_running
        return get_aws_ecs_task_running(app.core._envs,
                                        cluster_arn=cluster_arn,
                                        task_definition_arn=task_definition_arn,
                                        check_other_clusters=True)

    @route("/aws/ecs/task_last_run/{cluster_arn}/{task_definition_arn}", authorize=True)
    def reactapi_route_aws_ecs_task_last_run(cluster_arn: str, task_definition_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_tasks import get_aws_ecs_task_last_run
        return get_aws_ecs_task_last_run(app.core._envs,
                                         cluster_arn=cluster_arn,
                                         task_definition_arn=task_definition_arn)

    @route("/aws/ecs/tasks_running", authorize=True)
    def reactapi_route_aws_ecs_tasks_running() -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_tasks import get_aws_ecs_tasks_running
        return get_aws_ecs_tasks_running(cluster_arn=app.request_arg("cluster_arn"),
                                         task_definition_type=app.request_arg("task_name"),
                                         task_definition_arn=app.request_arg("task_definition_arn"))

    @route("/aws/ecs/task_run/{cluster_arn}/{task_definition_arn}", method="POST", authorize=True)
    def reactapi_route_aws_ecs_run_task(cluster_arn: str, task_definition_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_tasks import aws_ecs_run_task
        return aws_ecs_run_task(cluster_arn, task_definition_arn, app.request_body())

    @route("/aws/ecs/clusters_for_update", authorize=True)
    def reactapi_route_aws_ecs_clusters_for_update() -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_services import get_aws_ecs_clusters_for_update
        return get_aws_ecs_clusters_for_update(app.core._envs)

    @route("/aws/ecs/services_for_update/{cluster_arn}", authorize=True)
    def reactapi_route_aws_ecs_services_for_update(cluster_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_services import get_aws_ecs_services_for_update
        include_image = app.request_arg_bool("include_image", True)
        include_build = app.request_arg_bool("include_build", True)
        previous_builds = app.request_arg_int("previous_builds", 2)
        raw = app.request_arg_bool("raw", False)
        return get_aws_ecs_services_for_update(app.core._envs, cluster_arn,
                                               include_image=include_image,
                                               include_build=include_build,
                                               previous_builds=previous_builds, raw=raw)

    @route("/aws/ecr/image/{image_arn}", authorize=True)
    def reactapi_route_aws_ecr_image(image_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_services import get_aws_ecr_image_info
        image_arn = urllib.parse.unquote(image_arn)
        return get_aws_ecr_image_info(image_arn)

    @route("/aws/ecr/build/{image_arn}", authorize=True)
    def reactapi_route_aws_ecr_build(image_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_services import get_aws_ecr_build_info
        image_arn = urllib.parse.unquote(image_arn)
        previous_builds = app.request_arg_int("previous_builds", 2)
        return get_aws_ecr_build_info(image_arn, previous_builds=previous_builds)

    @route("/aws/codebuild/digest/{log_group}/{log_stream}", authorize=True)
    def reactapi_route_aws_codebuild_digest(log_group: str, log_stream: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_services import get_aws_codebuild_digest
        log_group = urllib.parse.unquote(log_group)
        image_tag = app.request_arg("image_tag")  # Just to narrow it down during the digest rummage
        return {"digest": get_aws_codebuild_digest(log_group, log_stream, image_tag)}

    @route("/aws/ecs/cluster_status/{cluster_arn}", authorize=True)
    def reactapi_route_aws_ecs_cluster_status(cluster_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_services import get_aws_ecs_cluster_status
        return get_aws_ecs_cluster_status(cluster_arn)

    @route("/aws/ecs/cluster_update/{cluster_arn}", method="POST", authorize=True)
    def reactapi_route_aws_ecs_update_cluster(cluster_arn: str) -> Response:  # noqa: implicit @staticmethod via @route
        from .aws_ecs_services import aws_ecs_update_cluster
        user = app.core.react_authorize(app.request(), app.core.get_default_env())["user"]
        return aws_ecs_update_cluster(cluster_arn, user)

    @route("/{env}/portal_health", authorize=True)
    def reactapi_route_portal_health(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_portal_health(env)

    @route("/aws/ecs/tasks/latest/details", authorize=True)
    def reactapi_route_aws_ecs_task() -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_aws_ecs_tasks(latest=True)

    @route("/{env}/ingestion_submissions", authorize=True)
    def reactapi_route_ingestion_submissions(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submissions in S3.
        - limit: to limit the results to the specified number.
        - offset: to skip past the first specified number of results.
        """
        return app.core.reactapi_ingestion_submissions(app.request(), env, args=app.request_args())

    @route("/{env}/ingestion_submissions/{uuid}", authorize=True)
    def reactapi_route_ingestion_submission(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submission in S3.
        """
        return app.core.reactapi_ingestion_submission_summary(app.request(), env, uuid, args=app.request_args())

    @route("/{env}/ingestion_submissions/{uuid}/detail", authorize=True)
    def reactapi_route_ingestion_submission_detail(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submission in S3.
        """
        return app.core.reactapi_ingestion_submission_detail(app.request(), env, uuid, args=app.request_args())

    @route("/{env}/ingestion_submissions/{uuid}/manifest", authorize=True)
    def reactapi_route_ingestion_submission_manifest(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submission in S3.
        """
        return app.core.reactapi_ingestion_submission_manifest(app.request(), env, uuid, args=app.request_args())

    @route("/{env}/ingestion_submissions/{uuid}/resolution", authorize=True)
    def reactapi_route_ingestion_submission_resolution(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submission in S3.
        """
        return app.core.reactapi_ingestion_submission_resolution(app.request(), env, uuid, args=app.request_args())

    @route("/{env}/ingestion_submissions/{uuid}/submission_response", authorize=True)
    def reactapi_route_ingestion_submission_submission_response(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submission in S3.
        """
        return app.core.reactapi_ingestion_submission_submission_response(app.request(),
                                                                          env, uuid, args=app.request_args())

    @route("/{env}/ingestion_submissions/{uuid}/traceback", authorize=True)
    def reactapi_route_ingestion_submission_traceback(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submission in S3.
        """
        return app.core.reactapi_ingestion_submission_traceback(app.request(), env, uuid, args=app.request_args())

    @route("/{env}/ingestion_submissions/{uuid}/validation_report", authorize=True)
    def reactapi_route_ingestion_submission_validation_report(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submission in S3.
        """
        return app.core.reactapi_ingestion_submission_validation_report(app.request(),
                                                                        env, uuid, args=app.request_args())

    @route("/{env}/ingestion_submissions/{uuid}/upload_info", authorize=True)
    def reactapi_route_ingestion_submission_upload_info(env: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info about ingestion submission in S3.
        """
        return app.core.reactapi_ingestion_submission_upload_info(app.request(), env, uuid, args=app.request_args())

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes, serving the HTML/CSS/JavaScript/React files.
    # Note that ALL of these are UNPROTECTED routes.
    # ----------------------------------------------------------------------------------------------

    # TODO: See if there is a better way to deal with variadic paths.
    # TODO: Maybe end up serving these from S3, for more security, and smaller Chalice package size.

    @route(root=True)
    def reactui_route_root() -> Response:  # noqa: implicit @staticmethod via @route
        return route_root()

    @route("/{env}", static=True, authorize=False, define_noenv_route=True)
    def reactui_route_0(env) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.react_serve_static_file(env, [])

    @route("/{env}/{path1}", static=True, authorize=False)
    def reactui_route_1(env, path1) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.react_serve_static_file(env, [path1])

    @route("/{env}/{path1}/{path2}", static=True, authorize=False)
    def reactui_route_2(env, path1, path2) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.react_serve_static_file(env, [path1, path2])

    @route("/{env}/{path1}/{path2}/{path3}", static=True, authorize=False)
    def reactui_route_3(env, path1, path2, path3) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.react_serve_static_file(env, [path1, path2, path3])

    @route("/{env}/{path1}/{path2}/{path3}/{path4}", static=True, authorize=False)
    def reactui_route_4(env, path1, path2, path3, path4) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.react_serve_static_file(env, [path1, path2, path3, path4])

    @route("/{env}/{path1}/{path2}/{path3}/{path4}/{path5}", static=True, authorize=False)
    def reactui_route_5(env, path1, path2, path3, path4, path5) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.react_serve_static_file(env, [path1, path2, path3, path4, path5])
