from chalice import Response
from dcicutils.misc_utils import ignored
from ...app import app
from .misc_utils import get_request_arg, get_request_args, get_request_body
from .react_route_decorator import route, route_root


class ReactRoutes:

    def __init__(self):
        super(ReactRoutes, self).__init__()

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes UNPROTECTED by authorization/authentication.
    # ----------------------------------------------------------------------------------------------

    @route("/{env}/auth0_config", authorize=False)
    def reactapi_route_auth0_config(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns Auth0 configuration for authentication (from Portal).
        Note that this in an UNPROTECTED route.
        """
        ignored(env)
        return ReactRoutes.reactapi_route_auth0_config_noenv()

    @route("/auth0_config", authorize=False)
    def reactapi_route_auth0_config_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns Auth0 configuration for authentication (from Portal).
        Note that this in an UNPROTECTED route.
        """
        return app.core.reactapi_auth0_config(app.current_request.to_dict())

    @route("/cognito_config", authorize=False)
    def reactapi_route_cognito_config() -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns AWS Cognito configuration for authentication; from environment variables or Secrets Manager;
        getting from one or the other happens in cognito.get_cognito_oauth_config.
        Note that this in an UNPROTECTED route.
        """
        return app.core.reactapi_cognito_config(app.current_request.to_dict())

    @route("/cognito/callback", authorize=False)
    def reactapi_route_cognito_callback() -> Response:  # noqa: implicit @staticmethod via @route
        # API version of reactapi_route_cognito_callback.
        """
        Secondary AWS Cognito OAuth callback; called from our primary frontend callback which is
        redirected to from Cognito so it can pick up the ouath_pkce_key (sic) which is written to
        browser session storage by the React authentication kickoff code (Amplify.federatedSignIn).
        Note that this in an UNPROTECTED route.
        """
        return app.core.reactapi_cognito_callback(app.current_request.to_dict())

    @route("/{env}/logout", authorize=False)
    def reactapi_route_logout(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Logs out the user. Sends back specific message if already logged out, or not.
        The env is not strictly required for logout, since we logout from all environments,
        but it is is useful for the redirect back, and also just for consistency/completeness.
        """
        return app.core.reactapi_logout(app.current_request.to_dict(), env)

    @route("/logout", authorize=False)
    def reactapi_route_logout_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/logout route.
        """
        return app.core.reactapi_logout(app.current_request.to_dict(), app.core.get_default_env())

    @route("/{env}/header", authorize=False)
    def reactapi_route_header(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Returns minimal data for React UI to get up and running.
        """
        return app.core.reactapi_header(app.current_request.to_dict(), env)

    @route("/header", authorize=False)
    def reactapi_route_header_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        No-env version of above /{env}/header route.
        """
        return app.core.reactapi_header(app.current_request.to_dict(), app.core.get_default_env())

    @route("/{env}/certificates", authorize=False)
    def reactapi_route_certificates(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Returns SSL certificate info about this Foursight instance and its associated Portal instance.
        """
        ignored(env)
        return ReactRoutes.reactapi_route_certificates_noenv()

    @route("/certificates", authorize=False)
    def reactapi_route_certificates_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Returns SSL certificate info about this Foursight instance and its associated Portal instance.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_certificates(request_dict, args)

    @route("/{env}/portal_access_key", authorize=False)
    def reactapi_route_portal_access_key(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Returns Portal access key info about this Foursight instance.
        """
        ignored(env)
        return ReactRoutes.reactapi_route_portal_access_key_noenv()

    @route("/portal_access_key", authorize=False)
    def reactapi_route_portal_access_key_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Returns Portal access key info about this Foursight instance.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_portal_access_key(request_dict, args)

    @route("/{env}/elasticsearch", authorize=False)
    def reactapi_route_elasticsearch_noenv(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Pings the Elasticsearch associated with this Foursight instance and returns related info.
        """
        ignored(env)
        return ReactRoutes.reactapi_route_elasticsearch_noenv()

    @route("/elasticsearch", authorize=False)
    def reactapi_route_elasticsearch_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        """
        Note that this in an UNPROTECTED route.
        Pings the Elasticsearch associated with this Foursight instance and returns related info.
        """
        return app.core.reactapi_elasticsearch()

    # ----------------------------------------------------------------------------------------------
    # Foursight React API routes PROTECTED by authorization/authentication.
    # ----------------------------------------------------------------------------------------------

    @route("/{env}/info", authorize=True)
    def reactapi_route_info(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns sundry info about the app.
        """
        return app.core.reactapi_info(app.current_request.to_dict(), env)

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
        if app.current_request.method == "GET":
            request_dict = app.current_request.to_dict()
            args = get_request_args(request_dict)
            return app.core.reactapi_get_users(request_dict, env, args)
        elif app.current_request.method == "POST":
            user = get_request_body(app.current_request)
            return app.core.reactapi_post_user(app.current_request.to_dict(), env, user=user)
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
        request_dict = app.current_request.to_dict()
        if app.current_request.method == "GET":
            args = get_request_args(request_dict)
            return app.core.reactapi_get_user(request_dict, env, uuid, args)
        elif app.current_request.method == "PATCH":
            user = get_request_body(app.current_request)
            return app.core.reactapi_patch_user(request_dict, env, uuid=uuid, user=user)
        elif app.current_request.method == "DELETE":
            return app.core.reactapi_delete_user(request_dict, env, uuid=uuid)
        else:
            return app.core.create_forbidden_response()

    @route("/{env}/users/institutions", authorize=True)
    def reactapi_route_users_institutions(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user insitutions.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_users_institutions(request_dict, env, args)

    @route("/{env}/users/projects", authorize=True)
    def reactapi_route_users_projects(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user projects.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_users_projects(request_dict, env, args)

    @route("/{env}/users/roles", authorize=True)
    def reactapi_route_users_roles(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the list of available user roles.
        """
        request_dict = app.current_request.to_dict()
        return app.core.reactapi_users_roles(request_dict, env)

    @route("/{env}/users/schema", authorize=True)
    def reactapi_route_users_schema(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the user schema (JSON) from ElasticSearch.
        """
        request_dict = app.current_request.to_dict()
        return app.core.reactapi_users_schema(request_dict, env)

    @route("/{env}/users/statuses", authorize=True)
    def reactapi_route_users_statuses(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the possible user status.
        """
        request_dict = app.current_request.to_dict()
        return app.core.reactapi_users_statuses(request_dict, env)

    @route("/{env}/checks", authorize=True)
    def reactapi_route_checks_ungrouped(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on all defined checks, NOT grouped by check group, as dictionary
        where each key name is the check name and its object contents contain the check details.
        For troubleshooting only.
        """
        return app.core.reactapi_checks_ungrouped(app.current_request.to_dict(), env)

    @route("/{env}/checks/grouped", authorize=True)
    def reactapi_route_checks_grouped(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on all defined checks, grouped by check group, as a list where
        each item is an object containing the group name and list of check detail objects.
        """
        return app.core.reactapi_checks_grouped(app.current_request.to_dict(), env)

    @route("/{env}/checks/grouped/schedule", authorize=True)
    def reactapi_route_checks_grouped_by_schedule(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on all defined checks, grouped by check group, as a list where each
        each item is an object containing the schedule namei and list list of check detail objecs.
        """
        return app.core.reactapi_checks_grouped_by_schedule(app.current_request.to_dict(), env)

    @route("/{env}/checks/{check}", authorize=True)
    def reactapi_route_checks_check(env: str, check: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the details of the given named checke as a dicitonary.
        """
        return app.core.reactapi_checks_check(app.current_request.to_dict(), env, check=check)

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
        request_dict = app.current_request.to_dict()
        return app.core.reactapi_checks_history(request_dict, env, check=check, args=get_request_args(request_dict))

    @route("/{env}/checks/{check}/history/latest", authorize=True)
    def reactapi_route_checks_history_latest(env: str, check: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the latest (most recent) run result for the given check.
        """
        request_dict = app.current_request.to_dict()
        return app.core.reactapi_checks_history_latest(app.current_request.to_dict(), env, check=check)

    @route("/{env}/checks/{check}/history/{uuid}", authorize=True)
    def reactapi_route_checks_history_uuid(env: str, check: str, uuid: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the result of the given check result by its (name and) uuid.
        """
        return app.core.reactapi_checks_history_uuid(app.current_request.to_dict(), env, check=check, uuid=uuid)

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
        request_dict = app.current_request.to_dict()
        return app.core.reactapi_checks_history_recent(request_dict, env, args=get_request_args(request_dict))

    @route("/{env}/checks/{check}/run", authorize=True)
    def reactapi_route_checks_run(env: str, check: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Kicks off a run of the given check.
        Arguments (args) for the request are any of:
        - args: Base-64 encode JSON object containing fields/values appropriate for the check run. 
        """
        request_dict = app.current_request.to_dict()
        return app.core.reactapi_checks_run(request_dict, env, check=check, args=get_request_arg(request_dict, "args"))

    @route("/{env}/action/{action}/run", authorize=True)
    def reactapi_route_action_run(env: str, action: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Kicks off a run of the given check.
        Arguments (args) for the request are any of:
        - args: Base-64 encode JSON object containing fields/values appropriate for the action run. 
        """
        request_dict = app.current_request.to_dict()
        return app.core.reactapi_action_run(request_dict, env, action=action, args=get_request_arg(request_dict, "args"))

    @route("/{env}/checks_status", authorize=True)
    def reactapi_route_checks_status(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on currently running/queueued checks.
        """
        return app.core.reactapi_checks_status(app.current_request.to_dict(), env)

    @route("/{env}/checks_raw", authorize=True)
    def reactapi_route_checks_raw(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns the contents of the raw check_setup.json file.
        """
        return app.core.reactapi_checks_raw(app.current_request.to_dict(), env)

    @route("/{env}/checks_registry", authorize=True)
    def reactapi_route_checks_registry(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed registered checks functions.
        """
        return app.core.reactapi_checks_registry(app.current_request.to_dict(), env)

    @route("/{env}/checks_validation", authorize=True)
    def reactapi_route_checks_validation(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns information about any problems with the checks setup.
        """
        return app.core.reactapi_checks_validation(app.current_request.to_dict(), env)

    @route("/{env}/lambdas", authorize=True)
    def reactapi_route_lambdas(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns detailed info on defined lambdas.
        """
        return app.core.reactapi_lambdas(app.current_request.to_dict(), env)

    @route("/{env}/gac/{env_compare}", authorize=True)
    def reactapi_route_gac_compare(env: str, env_compare: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Compares and returns diffs for values in the given two GACs.
        """
        return app.core.reactapi_gac_compare(app.current_request.to_dict(), env, env_compare=env_compare)

    @route("/{env}/aws/s3/buckets", authorize=True)
    def reactapi_route_aws_s3_buckets(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets(app.current_request.to_dict(), env)

    @route("/{env}/aws/s3/buckets/{bucket}", authorize=True)
    def reactapi_route_aws_s3_buckets_keys(env: str, bucket: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets_keys(app.current_request.to_dict(), env, bucket=bucket)

    @route("/{env}/aws/s3/buckets/{bucket}/{key}", authorize=True)
    def reactapi_route_aws_s3_buckets_key_contents(env: str, bucket: str, key: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        return app.core.reactapi_aws_s3_buckets_key_contents(app.current_request.to_dict(), env, bucket=bucket, key=key)

    @route("/{env}/accounts", authorize=True)
    def reactapi_route_accounts(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on known accounts/environments as defined in an accounts.json file if present.
        """
        return app.core.reactapi_accounts(app.current_request.to_dict(), env)

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
        return app.core.reactapi_account(app.current_request.to_dict(), env, name)

    @route("/{env}/aws/vpcs", authorize=True)
    def reactapi_route_aws_vpcs(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS VPCs.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_vpcs(request_dict, env, args=args)

    @route("/{env}/aws/vpcs/{vpc}", authorize=True)
    def reactapi_route_aws_vpc(env: str, vpc: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS VPC for the given VPC ID..
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_vpcs(request_dict, env, vpc, args=args)

    @route("/{env}/aws/subnets", authorize=True)
    def reactapi_route_aws_subnets(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Subnets.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_subnets(request_dict, env, args=args)

    @route("/{env}/aws/subnets/{subnet}", authorize=True)
    def reactapi_route_aws_subnet(env: str, subnet: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Subnet.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_subnets(request_dict, env, subnet, args=args)

    @route("/{env}/aws/security_groups", authorize=True)
    def reactapi_route_aws_security_groups(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Security Groups.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_security_groups(request_dict, env, args=args)

    @route("/{env}/aws/security_groups/{security_group}", authorize=True)
    def reactapi_route_aws_security_group(env: str, security_group: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Security Group.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_security_groups(request_dict, env, security_group, args=args)

    @route("/{env}/aws/security_group_rules/{security_group}", authorize=True)
    def reactapi_route_aws_security_group(env: str, security_group: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Security Group Rules.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_security_group_rules(request_dict, env, security_group, args=args)

    @route("/{env}/aws/network", authorize=True)
    def reactapi_route_aws_network(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS VPCs, Subnets, and Security Groups, grouped by VPC.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_network(request_dict, env, args=args)

    @route("/{env}/aws/network/{network}", authorize=True)
    def reactapi_route_aws_network(env: str, network: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS VPCs, Subnets, and Security Groups, grouped by VPC.
        Optional arguments (args) for the request are any of:
        - raw: if true then returns the raw format of the data.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_aws_network(request_dict, env, network, args=args)

    @route("/{env}/aws/stacks", authorize=True)
    def reactapi_route_aws_stacks(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info on AWS Stacks.
        """
        return app.core.reactapi_aws_stacks(app.current_request.to_dict(), env)

    @route("/{env}/aws/stacks/{stack}", authorize=True)
    def reactapi_route_aws_stack(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns info for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack(app.current_request.to_dict(), env, stack)

    @route("/{env}/aws/stacks/{stack}/outputs", authorize=True)
    def reactapi_route_aws_stack_outputs(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns outputs for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack_outputs(app.current_request.to_dict(), env, stack)

    @route("/{env}/aws/stacks/{stack}/parameters", authorize=True)
    def reactapi_route_aws_stack_parameters(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns parameters for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack_parameters(app.current_request.to_dict(), env, stack)

    @route("/{env}/aws/stacks/{stack}/resources", authorize=True)
    def reactapi_route_aws_stack_resources(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns resources for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack_resources(app.current_request.to_dict(), env, stack)

    @route("/{env}/aws/stacks/{stack}/template", authorize=True)
    def reactapi_route_aws_stack_template(env: str, stack: str) -> Response:  # noqa: implicit @staticmethod via @route
        """
        Returns template (as a string) for the given/named AWS Stack.
        """
        return app.core.reactapi_aws_stack_template(app.current_request.to_dict(), env, stack)

    @route("/__functioncache__", authorize=True)
    def reactapi_route_function_cache() -> Response:  # noqa: implicit @staticmethod via @route
        """
        For troubleshooting only. Returns function cache info.
        """
        return app.core.reactapi_function_cache(app.current_request.to_dict())

    @route("/__functioncacheclear__", authorize=True)
    def reactapi_route_function_cache() -> Response:  # noqa: implicit @staticmethod via @route
        """
        For troubleshooting only. Clears function cache.
        """
        request_dict = app.current_request.to_dict()
        args = get_request_args(request_dict)
        return app.core.reactapi_function_cache_clear(request_dict, args)

    @route("/__reloadlambda__", authorize=True)
    def reactapi_route_reload_lambda() -> Response:  # noqa: implicit @staticmethod via @route
        """
        For troubleshooting only. Reload the lambda code.
        """
        return app.core.reactapi_reload_lambda(app.current_request.to_dict())

    @route("/__testsize__/{n}", authorize=True)
    def reactapi_route_testsize(n: int) -> Response:  # noqa: implicit @staticmethod via @route
        """
        For troubleshooting only. Test response size capabilities of AWS Lamdas.
        """
        return app.core.reactapi_testsize(n)

    @route("/{env}/accounts_file", methods=["POST"], authorize=True)
    def reactapi_route_accounts_file_upload(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        ignored(env)
        return ReactRoutes.reactapi_route_accounts_file_upload_noenv()

    @route("/accounts_file", methods=["POST"], authorize=True)
    def reactapi_route_accounts_file_upload_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        accounts_file_data = get_request_body(app.current_request)
        return app.core.reactapi_accounts_file_upload(accounts_file_data)

    @route("/{env}/accounts_file", authorize=True)
    def reactapi_route_accounts_file_download(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        ignored(env)
        return ReactRoutes.reactapi_route_accounts_file_download_noenv()

    @route("/accounts_file", authorize=True)
    def reactapi_route_accounts_file_download_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_accounts_file_download()

    @route("/{env}/aws/secrets/{secrets_name}", authorize=True)
    def reactapi_route_aws_secrets(env: str, secrets_name: str) -> Response:  # noqa: implicit @staticmethod via @route
        ignored(env)
        return ReactRoutes.reactapi_route_aws_secrets_noenv(secrets_name)

    @route("/aws/secrets/{secrets_name}", authorize=True)
    def reactapi_route_aws_secrets_noenv(secrets_name: str) -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_aws_secrets(secrets_name)

    @route("/{env}/aws/secrets", authorize=True)
    def reactapi_route_aws_secret_names(env: str) -> Response:  # noqa: implicit @staticmethod via @route
        ignored(env)
        return ReactRoutes.reactapi_route_aws_secret_names_noenv()

    @route("/aws/secrets", authorize=True)
    def reactapi_route_aws_secret_names_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_aws_secret_names()

    @route("/aws/ecs/clusters", authorize=True)
    def reactapi_route_aws_ecs_clusters() -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.reactapi_aws_ecs_clusters()

    @route("/aws/ecs/clusters/{cluster_name}", authorize=True)
    def reactapi_route_aws_ecs_cluster(cluster_name: str) -> Response:  # noqa: implicit @staticmethod via @route
        cluster_name = "arn:aws:ecs:us-east-1:643366669028:cluster/c4-ecs-fourfront-webdev-stack-FourfrontWebdev-rSLwZBbdVTtx"
        return app.core.reactapi_aws_ecs_cluster(cluster_name=cluster_name)

    # ----------------------------------------------------------------------------------------------
    # Foursight React UI (static file) routes, serving the HTML/CSS/JavaScript/React files.
    # Note that ALL of these are UNPROTECTED routes.
    # ----------------------------------------------------------------------------------------------

    # TODO: See if there is a better way to deal with variadic paths.
    # TODO: Maybe end up serving these from S3, for more security, and smaller Chalice package size.

    @route(root=True)
    def reactui_route_root() -> Response:  # noqa: implicit @staticmethod via @route
        return route_root()

    @route("/", static=True, authorize=False)
    def reactui_route_static_file_noenv() -> Response:  # noqa: implicit @staticmethod via @route
        return app.core.react_serve_static_file(app.core.get_default_env(), [])

    @route("/{env}", static=True, authorize=False)
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
