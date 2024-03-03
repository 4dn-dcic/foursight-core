import boto3
from chalice import Cron
import copy
import cron_descriptor
import logging
import os
from typing import Callable, Optional
from dcicutils.function_cache_decorator import function_cache
from ...decorators import Decorators
from .envs import Envs

logging.basicConfig()
logger = logging.getLogger(__name__)


class Checks:

    def __init__(self, check_setup, envs: Envs):
        self._check_setup_raw = check_setup
        self._check_setup = copy.deepcopy(check_setup)
        self._envs = envs

    def get_checks_raw(self) -> dict:
        """
        Returns a dictionary containing the pristine, original check_setup.json file contents.
        """
        return self._check_setup_raw

    @function_cache
    def _get_checks(self) -> dict:
        checks = self._check_setup
        for check_key in checks.keys():
            checks[check_key]["name"] = check_key
            checks[check_key]["group"] = checks[check_key]["group"]
        lambdas = self.get_annotated_lambdas()
        self._annotate_checks_for_dependencies(checks)
        self._annotate_checks_with_schedules_from_lambdas(checks, lambdas)
        self._annotate_checks_with_kwargs_from_decorators(checks)
        return checks

    @function_cache
    def get_checks(self, env: str) -> dict:
        """
        Returns a dictionary containing all checks, annotated with various info,
        e.g. the (cron) schedule from the associated lambdas, check kwargs, and
        associated actions, from the check function decorators; filtered by the
        given env name. Cached on the first call, except for the filtering part.
        """
        return self._filter_checks_by_env(self._get_checks(), env)

    @function_cache
    def get_checks_grouped(self, env: str) -> list:
        """
        Like get_checks but returns the checks grouped by their group names.
        """
        grouped_checks = []
        checks = self.get_checks(env)
        for check_name in checks:
            check_item = checks[check_name]
            check_item_group = check_item["group"]
            found = False
            for grouped_check in grouped_checks:
                if grouped_check["group"] == check_item_group:
                    grouped_check["checks"].append(check_item)
                    found = True
                    break
            if not found:
                grouped_checks.append({"group": check_item_group, "checks": [check_item]})
        return grouped_checks

    @function_cache
    def get_checks_grouped_by_schedule(self, env: str) -> list:
        """
        Like get_checks_grouped but groups by schedule (i.e. by scheduling lambdas).
        """
        def create_schedule_group_title(name: str):
            """
            Pretty lame title-ifying the groiup name for display purposes, based
            on what we know about the currently existing scheduling lambda names.
            """
            name = name.replace("Min", " Minute")
            if name.endswith("Checks"):
                return name[:len(name) - len("Checks") - 0]
            elif name.endswith("Checks1"):
                return name[:len(name) - len("Checks1") - 0] + " I"
            elif name.endswith("Checks2"):
                return name[:len(name) - len("Checks2") - 0] + " II"
            elif name.endswith("Checks3"):
                return name[:len(name) - len("Checks3") - 0] + " III"
            elif name.endswith("Checks4"):
                return name[:len(name) - len("Checks4") - 0] + " IV"
            elif name.endswith("Checks5"):
                return name[:len(name) - len("Checks5") - 0] + " V"
            else:
                return name
        grouped_checks = []
        lambdas = self.get_annotated_lambdas()
        for lambda_item in lambdas:
            schedule_group_name = create_schedule_group_title(lambda_item["lambda_name"])
            if isinstance(lambda_item.get("lambda_checks"), list) and len(lambda_item["lambda_checks"]) > 0:
                for lambda_item_check in lambda_item["lambda_checks"]:
                    check = self.get_check(env, lambda_item_check.get("check_name"))
                    if check:
                        group = [group for group in grouped_checks if group["group"] == schedule_group_name]
                        if len(group) == 0:
                            group = {
                                "group": schedule_group_name,
                                "checks": []
                            }
                            grouped_checks.append(group)
                        else:
                            group = group[0]
                        group["checks"].append(check)
        return grouped_checks

    @function_cache
    def get_check(self, env: str, check: str) -> Optional[dict]:
        """
        Returns the check for the given check name; filtered by the given env name.
        If it turns out the check name is really an action then return its info;
        there is a 'type' property set to 'check' or 'action indicating which it is.
        """
        checks = self.get_checks(env)
        for check_key in checks.keys():
            if check_key == check:
                return {"type": "check", **checks[check_key]}
        return self._get_action(env, check)

    def _get_action_checks(self, env: str, action: str) -> list:
        """
        Returns the list of checks associated with the given action.
        """
        action_checks = []
        checks = self.get_checks(env)
        for check in checks.values():
            if check.get("registered_action"):
                if check["registered_action"].get("name") == action:
                    action_checks.append(check)
        return action_checks

    def _get_action(self, env: str, action: str) -> Optional[dict]:
        checks = self.get_checks(env)
        for check_key in checks.keys():
            check = checks[check_key]
            if check.get("registered_action") and check["registered_action"].get("name") == action:
                action_checks = self._get_action_checks(env, action)
                action_title = " ".join(action.split("_")).title()
                return {"type": "action", **check["registered_action"], "checks": action_checks, "title": action_title}
        return None

    def _filter_checks_by_env(self, checks: dict, env: str) -> dict:
        """
        Returns the given checks filtered by the given env name.
        """
        if not env:
            return checks
        checks_for_env = {}
        for check_key in checks.keys():
            included = False
            if checks[check_key].get("schedule"):
                for check_schedule_key in checks[check_key]["schedule"].keys():
                    for check_env_key in checks[check_key]["schedule"][check_schedule_key].keys():
                        if check_env_key == "all" or self._envs.is_same_env(check_env_key, env):
                            included = True
                            checks_for_env[check_key] = checks[check_key]
            else:
                # If no schedule section (which has the env section) then include it.
                included = True
                checks_for_env[check_key] = checks[check_key]
            if not included:
                if isinstance(checks[check_key].get("display"), list):
                    for check_env_key in checks[check_key]["display"]:
                        if check_env_key == "all" or self._envs.is_same_env(check_env_key, env):
                            checks_for_env[check_key] = checks[check_key]
        return checks_for_env

    def _annotate_checks_for_dependencies(self, checks: dict) -> None:
        """
        Annotates the give checks dictionary with "referrer" information related to the
        check "dependencies". A check may have a list of dependencies, and for general
        info (in the UI) and troubleshooting purposes, it would be useful to also 
        have the inverse relationship, i.e. for each check which is part of another
        check dependency, we create a "referrers" list with the names of any checks
        which depend on (refer to) the check, i.e. which have it in its dependencies
        list. This is intended to be called once and cached (see: get_checks).
        """
        def get_check(check_name: str, env: str) -> Optional[dict]:
            """
            Returns the check from the (outer) checks dictionary with the given name;
            we can't use the top-level get_checks because that one calls into this,
            which would result in infinite recursion; this is a startup/bootstrap activity.
            """
            for check_key in self._filter_checks_by_env(checks, env):
                if check_key == check_name:
                    return checks[check_key]
            return None

        for check_name in checks:
            check = checks[check_name]
            if isinstance(check.get("schedule"), dict):
                check_schedules = check["schedule"]
                for check_schedule_name in check_schedules:
                    check_schedule = check_schedules[check_schedule_name]
                    if isinstance(check_schedule, dict):
                        for check_schedule_key in check_schedule:
                            check_schedule_item = check_schedule[check_schedule_key]
                            if isinstance(check_schedule_item, dict):
                                check_schedule_env_name = check_schedule_key
                                if isinstance(check_schedule_item.get("dependencies"), list):
                                    for check_dependency_name in check_schedule_item["dependencies"]:
                                        check_dependency = get_check(check_dependency_name, check_schedule_env_name)
                                        if check_dependency:
                                            if not isinstance(check_dependency.get("referrers"), list):
                                                check_dependency["referrers"] = [check_name]
                                            elif check_name not in check_dependency["referrers"]:
                                                check_dependency["referrers"].append(check_name)

    @staticmethod
    def _get_stack_name() -> str:
        """
        Returns our AWS defined stack name, as specified by the STACK_NAME environment variable.
        """
        return os.environ.get("STACK_NAME")

    def _get_stack_template(self, stack_name: str = None) -> dict:
        """
        Returns our AWS stack template, for our defined AWS stack.
        """
        if not stack_name:
            stack_name = self._get_stack_name()
            if not stack_name:
                return {}
        boto_cloudformation = boto3.client('cloudformation')
        return boto_cloudformation.get_template(StackName=stack_name)

    @staticmethod
    def _get_lambdas_from_template(stack_template: dict) -> list:
        """
        Returns the list of lambda names and associated info for our defined AWS stack.
        """
        lambda_definitions = []
        stack_template = stack_template["TemplateBody"]["Resources"]
        for resource_key in stack_template:
            resource_type = stack_template[resource_key]["Type"]
            if resource_type == "AWS::Lambda::Function":
                lambda_name = resource_key
                lambda_properties = stack_template[lambda_name]["Properties"]
                lambda_code_s3_bucket = lambda_properties["Code"]["S3Bucket"]
                lambda_code_s3_bucket_key = lambda_properties["Code"]["S3Key"]
                lambda_handler = lambda_properties["Handler"]
                lambda_definitions.append({
                    "lambda_name": lambda_name,
                    "lambda_code_s3_bucket": lambda_code_s3_bucket,
                    "lambda_code_s3_bucket_key": lambda_code_s3_bucket_key,
                    "lambda_handler": lambda_handler
                })
        return lambda_definitions

    @staticmethod
    def _annotate_lambdas_with_schedules_from_template(lambdas: list, stack_template: dict) -> list:
        """
        Annotates and returns the given AWS lambdas list with
        the (cron) schedules from the given associated AWS stack template.
        """
        def is_cron_schedule_never(cron: str) -> bool:
            try:
                cron_split = cron.split(' ')
                cron = Cron(*cron_split)
                # Just check the most obvious things.
                # We are known to only use Feb 31 to indicate Never.
                if cron.month.isnumeric():
                    month = int(cron.month)
                    if month < 1 or month > 12:
                        return True
                else:
                    month = None
                if cron.day_of_month.isnumeric():
                    day_of_month = int(cron.day_of_month)
                    if day_of_month < 1 or day_of_month > 31:
                        return True
                    if month == 2 and day_of_month > 29:
                        return True
                    if month in [4, 6, 9, 11] and day_of_month > 30:
                        return True
            except Exception:
                pass
            return False

        stack_template = stack_template["TemplateBody"]["Resources"]
        for resource_key in stack_template:
            resource_type = stack_template[resource_key]["Type"]
            if resource_type == "AWS::Events::Rule":
                event_name = resource_key
                event_properties = stack_template[event_name]["Properties"]
                event_schedule = event_properties["ScheduleExpression"]
                if event_schedule:
                    event_targets = event_properties["Targets"]
                    for event_target in event_targets:
                        event_target = dict(event_target)
                        event_target_arn = dict(event_target["Arn"])
                        event_target_function_arn = event_target_arn["Fn::GetAtt"]
                        if len(event_target_function_arn) == 2 and "Arn" in event_target_function_arn:
                            if event_target_function_arn[0] == "Arn":
                                event_target_function_name = event_target_function_arn[1]
                            else:
                                event_target_function_name = event_target_function_arn[0]
                            if event_target_function_name:
                                for la in lambdas:
                                    if la["lambda_name"] == event_target_function_name:
                                        event_schedule = str(event_schedule).replace("cron(", "").replace(")", "")
                                        la["lambda_schedule"] = str(event_schedule)
                                        if is_cron_schedule_never(event_schedule):
                                            cron_description = "Never"
                                        else:
                                            cron_description = cron_descriptor.get_description(str(event_schedule))
                                            if cron_description.startswith("At "):
                                                cron_description = cron_description[3:]
                                            cron_description = cron_description + " (UTC)"
                                        la["lambda_schedule_description"] = cron_description
        return lambdas

    @staticmethod
    def _annotate_lambdas_with_function_metadata(lambdas: list) -> list:
        """
        Annotates and returns the given AWS lambdas list with various AWS lambda metadata,
        e.g. the function name and ARN, code size, role, and description.
        """
        boto_lambda = boto3.client("lambda")
        # lambda_functions = boto_lambda.list_functions()["Functions"]
        lambda_functions = Checks._get_all_lambda_functions()
        for lambda_function in lambda_functions:
            lambda_function_handler = lambda_function["Handler"]
            for la in lambdas:
                if la["lambda_handler"] == lambda_function_handler:
                    la["lambda_function_name"] = lambda_function["FunctionName"]
                    la["lambda_function_arn"] = lambda_function["FunctionArn"]
                    la["lambda_code_size"] = lambda_function["CodeSize"]
                    la["lambda_modified"] = lambda_function["LastModified"]
                    la["lambda_description"] = lambda_function["Description"]
                    la["lambda_role"] = lambda_function["Role"]
                    #
                    # Look for the real modified time which may be in the tag if we ever did a manual
                    # reload of the lambda which will do its job by making an innocuous change to the
                    # lambda (its description) but which also has the effect of changing its modified
                    # time, so that process also squirrels away the real lambda modified time in a
                    # tag called last_modified. See the reload_lambda function for details of this.
                    try:
                        lambda_function_tags = boto_lambda.list_tags(Resource=lambda_function["FunctionArn"])["Tags"]
                        lambda_modified = lambda_function_tags.get("last_modified")
                        if lambda_modified:
                            la["lambda_modified"] = lambda_modified
                    except Exception as e:
                        logger.warning(f"Exception getting AWS lambdas info: {e}")
                        pass
        return lambdas

    @staticmethod
    def _annotate_lambdas_with_check_setup(lambdas: list, checks: dict) -> list:
        """
        Annotates and returns the given AWS lambdas list with info from the given checks.
        """
        if not checks or not isinstance(checks, dict):
            return lambdas
        for check_name in checks:
            check_item = checks[check_name]
            check_item_schedule = check_item.get("schedule")
            if check_item_schedule:
                for check_item_schedule_name in check_item_schedule.keys():
                    for lambda_item in lambdas:
                        if (lambda_item["lambda_handler"] == check_item_schedule_name
                                or lambda_item["lambda_handler"] == "app." + check_item_schedule_name):
                            if not lambda_item.get("lambda_checks"):
                                lambda_item["lambda_checks"] = []
                            lambda_item["lambda_checks"].append({
                                "check_title": check_item.get("title"),
                                "check_name": check_name,
                                "check_group": check_item.get("group")
                            })
        for lambda_item in lambdas:
            if lambda_item.get("lambda_checks"):
                lambda_item["lambda_checks"].sort(key=lambda item: f"{item['check_group']}.{item['check_name']}")
        return lambdas

    @function_cache
    def _get_annotated_lambdas(self) -> dict:
        stack_name = self._get_stack_name()
        stack_template = self._get_stack_template(stack_name)
        lambdas = self._get_lambdas_from_template(stack_template)
        lambdas = self._annotate_lambdas_with_schedules_from_template(lambdas, stack_template)
        lambdas = self._annotate_lambdas_with_function_metadata(lambdas)
        lambdas = self._annotate_lambdas_with_check_setup(lambdas, self._check_setup)
        return lambdas

    @function_cache
    def get_annotated_lambdas(self, env: Optional[str] = None) -> dict:
        """
        Returns the dictionary of all AWS lambdas for our defined stack.
        """
        return self._filter_lambdas_by_env(self._get_annotated_lambdas(), env)

    def _filter_lambdas_by_env(self, lambdas: list, env: Optional[str] = None) -> list:
        """
        Filters the given list of lambda info by the given environment (i.e. just the
        list of checks within each lambda info record), and returns the resultant list.
        The given list of lambda info is NOT changed (i.e. makes copies if modified).
        """
        if not env:
            return lambdas
        filtered_lambdas = []
        for lambda_item in lambdas:
            lambda_checks = lambda_item.get("lambda_checks")
            if isinstance(lambda_checks, list) and len(lambda_checks) > 0:
                lambda_item = copy.deepcopy(lambda_item)
                lambda_checks_filtered = []
                for lambda_check in lambda_checks:
                    check = self.get_check(env, lambda_check.get("check_name"))
                    if check:
                        lambda_checks_filtered.append(lambda_check)
                lambda_item["lambda_checks"] = lambda_checks_filtered
            filtered_lambdas.append(lambda_item)
        return filtered_lambdas

    @staticmethod
    def _annotate_checks_with_schedules_from_lambdas(checks: dict, lambdas: dict) -> None:
        """
        Annotates the given checks with the (cron) schedule from the given associated AWS lambdas.
        """
        for check_name in checks:
            check_item = checks[check_name]
            check_schedule = check_item.get("schedule")
            if check_schedule:
                for check_schedule_name in check_schedule.keys():
                    for la in lambdas:
                        if (la["lambda_handler"] == check_schedule_name
                                or la["lambda_handler"] == "app." + check_schedule_name):
                            check_schedule[check_schedule_name]["cron"] = la["lambda_schedule"]
                            check_schedule[check_schedule_name]["cron_description"] = la["lambda_schedule_description"]

    @function_cache
    def get_registry(self) -> dict:
        """
        Returns the checks registry dictionary which was set up by the @check_function
        and @action_function decoratros (deifned in decorators.py).
        """
        registry = Decorators.get_registry()
        registered_checks = [check for check in registry if registry[check]["kind"] == "check"]
        registered_actions = [check for check in registry if registry[check]["kind"] == "action"]
        for check_name in registered_checks:
            check = registry[check_name]
            # A check may have at most one associated action;
            # but the same action may be associated with more than
            # one check; setup the latter part of that relationship here.
            associated_action_name = check.get("action")
            if associated_action_name:
                action = registry[associated_action_name]
                if not action.get("checks"):
                    action["checks"] = []
                action["checks"].append(check_name)
        return registry

    def _annotate_checks_with_kwargs_from_decorators(self, checks: dict) -> None:
        """
        Annotates the given checks with kwargs info from the check functions decorators.
        """
        # Decorators.get_registry() is a dictionary keyed by (unique) decorator function
        # name; the value of each key is an object contain the args, kwargs fields, as well
        # as other (file, module, asssociated action, etc) metadata for display purposes.
        def get_base_module_name(module: str) -> str:
            return module.split(".")[-1:][0] if module else module
        checks_registry = self.get_registry()
        registered_checks = [check for check in checks_registry if checks_registry[check]["kind"] == "check"]
        if not registered_checks:
            return
        for check_name in checks:
            check_item = checks[check_name]
            for check_function_name in registered_checks:
                if check_name == check_function_name:
                    registered_check = checks_registry[check_function_name]
                    check_item["registered_file"] = registered_check.get("file")
                    check_item["registered_line"] = registered_check.get("line")
                    check_item["registered_module"] = registered_check.get("module")
                    check_item["registered_package"] = registered_check.get("package")
                    check_item["registered_github_url"] = registered_check.get("github_url")
                    registered_check_kwargs = registered_check.get("kwargs")
                    if registered_check_kwargs:
                        check_item["registered_kwargs"] = registered_check_kwargs
                    registered_check_args = registered_check.get("args")
                    if registered_check_args:
                        check_item["registered_args"] = registered_check_args
                    # Get any associated action; this is from the (new as of early December 2022)
                    # action property specified in the @check_function decorator for the check
                    # function; this is used only for informational purposes in the UI. 
                    registered_action_function_name = registered_check.get("action")
                    if registered_action_function_name:
                        registered_action = checks_registry.get(registered_action_function_name)
                        if registered_action and registered_action.get("kind") == "action":
                            check_item["registered_action"] = {
                                "name": registered_action.get("name"),
                                "file": registered_action.get("file"),
                                "line": registered_action.get("line"),
                                "module": get_base_module_name(registered_action.get("module")),
                                "registered_module": registered_action.get("module"),
                                "package": registered_action.get("package"),
                                "github_url": registered_action.get("github_url"),
                                "checks": registered_action.get("checks")
                            }

    @staticmethod
    def _get_all_lambda_functions() -> list:
        """
        Returns a list of objects from boto3 (lambda.list_functions) for each lambda
        function within our stack as defined by _get_stack_name (i.e. from the global
        STACK_NAME environment variable, and where each lambda also has the STACK_NAME
        environment variable defined for it).
        """
        stack_name = Checks._get_stack_name()
        def lambda_filter(lambda_function: dict) -> bool:
            if lambda_function:
                lambda_function_environment = lambda_function.get("Environment")
                if lambda_function_environment:
                    lambda_function_environment_variables = lambda_function_environment.get("Variables")
                    if lambda_function_environment_variables:
                        lambda_function_stack_name = lambda_function_environment_variables.get("STACK_NAME")
                        return lambda_function_stack_name == stack_name
            return False
        boto_lambda = boto3.client("lambda")
        results = []
        marker = None
        while True:
            if marker:
                lambda_functions = boto_lambda.list_functions(Marker=marker)
            else:
                lambda_functions = boto_lambda.list_functions()
            if not lambda_functions or not lambda_functions.get("Functions"):
                break
            for lambda_function in lambda_functions["Functions"]:
                if lambda_filter(lambda_function):
                    results.append(lambda_function)
            marker = lambda_functions.get("NextMarker")
            if not marker:
                break
        return results
