import boto3
from chalice import Cron
import copy
import cron_descriptor
import logging
import os
from typing import Callable, Optional
from ...decorators import Decorators
from .envs import Envs

logging.basicConfig()
logger = logging.getLogger(__name__)


class Checks:

    def __init__(self, check_setup, envs: Envs):
        self._check_setup = copy.deepcopy(check_setup)
        self._envs = envs

    _cached_checks = None
    _cached_lambdas = None

    def get_checks_raw(self) -> dict:
        """
        Returns a dictionary containing the pristine, original check_setup.json file contents.
        """
        return self._check_setup

    def get_checks(self, env: str) -> dict:
        """
        Returns a dictionary containing all checks, annotated with various info,
        e.g. the (cron) schedule from the associated lambdas, and check kwargs,
        from the check function decorators; filtered by the given env name.
        Cached on/after the first call.
        """
        if not Checks._cached_checks:
            checks = self.get_checks_raw()
            for check_key in checks.keys():
                checks[check_key]["name"] = check_key
                checks[check_key]["group"] = checks[check_key]["group"]
            lambdas = self.get_annotated_lambdas()
            self._annotate_checks_with_schedules_from_lambdas(checks, lambdas)
            self._annotate_checks_with_kwargs_from_decorators(checks)
            Checks._cached_checks = checks
        return self._filter_checks_by_env(Checks._cached_checks, env)

    def get_checks_grouped(self, env: str) -> list:
        """
        Like get_checks but returns the checks grouped by their group names.
        """
        checks_groups = []
        checks = self.get_checks(env)
        for check_name in checks:
            check_item = checks[check_name]
            check_item_group = check_item["group"]
            # TODO: Probably a more pythonic way to do this.
            found = False
            for grouped_check in checks_groups:
                if grouped_check["group"] == check_item_group:
                    grouped_check["checks"].append(check_item)
                    found = True
                    break
            if not found:
                checks_groups.append({"group": check_item_group, "checks": [check_item]})
        return checks_groups

    def get_check(self, env: str, check: str) -> Optional[dict]:
        """
        Returns the check for the given check name; filtered by the given env name.
        """
        checks = self.get_checks(env)
        for check_key in checks.keys():
            if check_key == check:
                return checks[check_key]
        return None

    def _filter_checks_by_env(self, checks: dict, env: str) -> dict:
        """
        Returns the given checks filtered by the given env name.
        """
        if not env:
            return checks
        checks_for_env = {}
        for check_key in checks.keys():
            if checks[check_key]["schedule"]:
                for check_schedule_key in checks[check_key]["schedule"].keys():
                    for check_env_key in checks[check_key]["schedule"][check_schedule_key].keys():
                        if check_env_key == "all" or self._envs.is_same_env(check_env_key, env):
                            checks_for_env[check_key] = checks[check_key]
            else:
                # If no schedule section (which has the env section) then include it.
                checks_for_env[check_key] = checks[check_key]
        return checks_for_env

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

    def get_annotated_lambdas(self) -> dict:
        """
        Returns the dictionary of all AWS lambdas for our defined stack.
        """
        if not Checks._cached_lambdas:
            stack_name = self._get_stack_name()
            stack_template = self._get_stack_template(stack_name)
            lambdas = self._get_lambdas_from_template(stack_template)
            lambdas = self._annotate_lambdas_with_schedules_from_template(lambdas, stack_template)
            lambdas = self._annotate_lambdas_with_function_metadata(lambdas)
            lambdas = self._annotate_lambdas_with_check_setup(lambdas, self.get_checks_raw())
            Checks._cached_lambdas = lambdas
        return Checks._cached_lambdas

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

    @staticmethod
    def _annotate_checks_with_kwargs_from_decorators(checks: dict) -> None:
        """
        Annotates the given checks with kwargs info from the check functions decorators.
        """
        # Decorators.get_registry() is a dictionary keyed by (unique) decorator function
        # name; the value of each key is an object contain these fields: args, kwargs.
        checks_decorators = Decorators.get_registry()
        if not checks_decorators:
            return
        for check_name in checks:
            check_item = checks[check_name]
            for check_decorator_function_name in checks_decorators:
                check_decorator = checks_decorators[check_decorator_function_name]
                if check_name == check_decorator_function_name:
                    check_item["registered_file"] = check_decorator.get("file")
                    check_item["registered_line"] = check_decorator.get("line")
                    check_item["registered_module"] = check_decorator.get("module")
                    check_item["registered_package"] = check_decorator.get("package")
                    check_item["registered_github_url"] = check_decorator.get("github_url")
                    check_decorator_kwargs = check_decorator.get("kwargs")
                    if check_decorator_kwargs:
                        check_item["registered_kwargs"] = check_decorator_kwargs
                    check_decorator_args = check_decorator.get("args")
                    if check_decorator_args:
                        check_item["registered_args"] = check_decorator_args

    @staticmethod
    def _get_all_lambda_functions(lambda_filter: Optional[Callable] = None) -> list:
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
                if isinstance(lambda_filter, Callable):
                    if not lambda_filter(lambda_function):
                        continue
                results.append(lambda_function)
            marker = lambda_functions.get("NextMarker")
            if not marker:
                break
        return results

    def cache_clear(self) -> None:
        self._cached_checks = None
        self._cached_lambdas = None
