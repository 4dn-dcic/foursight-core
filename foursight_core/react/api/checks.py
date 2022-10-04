import cron_descriptor
import os
import boto3
from ...decorators import Decorators
from .envs import Envs


class Checks:

    def __init__(self, check_setup, envs: Envs):
        self.check_setup = check_setup
        self.envs = envs

    class Cache:
        checks = None
        lambdas = None

    def get_checks_raw(self) -> list:
        return self.check_setup

    def get_checks(self, env: str) -> list:
        if not Checks.Cache.checks:
            checks = self.get_checks_raw()
            for check_key in checks.keys():
                checks[check_key]["name"] = check_key
                checks[check_key]["group"] = checks[check_key]["group"]
            lambdas = self.get_annotated_lambdas()
            self.annotate_checks_with_schedules_from_lambdas(checks, lambdas)
            self.annotate_checks_with_kwargs_from_decorators(checks)
            Checks.Cache.checks = checks
        return self.filter_checks_by_env(Checks.Cache.checks, env)

    def get_checks_grouped(self, env: str) -> list:
        checks_groups = []
        checks = self.get_checks(env)
        for check_setup_item_name in checks:
            check_setup_item = checks[check_setup_item_name]
            check_setup_item_group = check_setup_item["group"]
            # TODO: Probably a nore pythonic way to do this.
            found = False
            for grouped_check in checks_groups:
                if grouped_check["group"] == check_setup_item_group:
                    grouped_check["checks"].append(check_setup_item)
                    found = True
                    break
            if not found:
                checks_groups.append({ "group": check_setup_item_group, "checks": [check_setup_item]})
        return checks_groups

    def get_checks_grouped_by_schedule(self, env: str) -> list:
        checks_grouped_by_schedule = []
        # TODO
        return checks_grouped_by_schedule

    def get_check(self, env: str, check: str) -> dict:
        checks = self.get_checks(env)
        for check_key in checks.keys():
            if check_key == check:
                return checks[check_key]
        return check

    def filter_checks_by_env(self, checks: dict, env) -> dict:
        if not env:
            return checks
        checks_for_env = {}
        for check_key in checks:
            if checks[check_key]["schedule"]:
                for check_schedule_key in checks[check_key]["schedule"].keys():
                    for check_env_key in checks[check_key]["schedule"][check_schedule_key].keys():
                        if check_env_key == "all" or self.envs.is_same_env(check_env_key, env):
                            checks_for_env[check_key] = checks[check_key]
            else:
                # If no schedule section (which has the env section) then include it.
                checks_for_env[check_key] = checks[check_key]
        return checks_for_env

    def get_stack_name(self) -> str:
        return os.environ.get("STACK_NAME")

    def get_stack_template(self, stack_name: str = None) -> dict:
        if not stack_name:
            stack_name = self.get_stack_name()
            if not stack_name:
                return {}
        boto_cloudformation = boto3.client('cloudformation')
        return boto_cloudformation.get_template(StackName=stack_name)

    def get_lambdas_from_template(self, stack_template: dict) -> list:
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

    def annotate_lambdas_with_schedules_from_template(self, lambdas: list, stack_template: dict) -> list:
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
                                        cron_description = cron_descriptor.get_description(str(event_schedule))
                                        if cron_description.startswith("At "):
                                            cron_description = cron_description[3:]
                                        la["lambda_schedule_description"] = cron_description
        return lambdas

    def annotate_lambdas_with_function_metadata(self, lambdas: list) -> list:
        boto_lambda = boto3.client("lambda")
        lambda_functions = boto_lambda.list_functions()["Functions"]
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
                    except:
                        pass
        return lambdas

    def annotate_lambdas_with_check_setup(self, lambdas: list, checks: list) -> list:
        if not checks or not isinstance(checks, dict):
            return lambdas
        for check_setup_item_name in checks:
            check_setup_item = checks[check_setup_item_name]
            check_setup_item_schedule = check_setup_item.get("schedule")
            if check_setup_item_schedule:
                for check_setup_item_schedule_name in check_setup_item_schedule.keys():
                    for la in lambdas:
                        if la["lambda_handler"] == check_setup_item_schedule_name or la["lambda_handler"] == "app." + check_setup_item_schedule_name:
                            if not la.get("lambda_checks"):
                                la["lambda_checks"] = [check_setup_item_schedule_name]
                            elif check_setup_item_schedule_name not in la["lambda_checks"]:
                                la["lambda_checks"].append(check_setup_item_schedule_name)
        return lambdas

    def get_annotated_lambdas(self) -> dict:
        if not Checks.Cache.lambdas:
            stack_name = self.get_stack_name()
            stack_template = self.get_stack_template(stack_name)
            lambdas = self.get_lambdas_from_template(stack_template)
            lambdas = self.annotate_lambdas_with_schedules_from_template(lambdas, stack_template)
            lambdas = self.annotate_lambdas_with_function_metadata(lambdas)
            lambdas = self.annotate_lambdas_with_check_setup(lambdas, self.get_checks_raw())
            Checks.Cache.lambdas = lambdas
        return Checks.Cache.lambdas

    def annotate_checks_with_schedules_from_lambdas(self, checks: dict, lambdas: dict) -> None:
        for check_setup_item_name in checks:
            check_setup_item = checks[check_setup_item_name]
            check_setup_item_schedule = check_setup_item.get("schedule")
            if check_setup_item_schedule:
                for check_setup_item_schedule_name in check_setup_item_schedule.keys():
                    for la in lambdas:
                        if la["lambda_handler"] == check_setup_item_schedule_name or la["lambda_handler"] == "app." + check_setup_item_schedule_name:
                            check_setup_item_schedule[check_setup_item_schedule_name]["cron"] = la["lambda_schedule"]
                            check_setup_item_schedule[check_setup_item_schedule_name]["cron_description"] = la["lambda_schedule_description"]

    def annotate_checks_with_kwargs_from_decorators(self, checks: dict) -> None:
        checks_decorators = Decorators.get_registry()
        for check_setup_item_name in checks:
            check_setup_item = checks[check_setup_item_name]
            for checks_decorator in checks_decorators:
                checks_decorator_function_name = checks_decorator.get("function")
                if check_setup_item_name == checks_decorator_function_name:
                    checks_decorator_kwargs = checks_decorator.get("kwargs")
                    if checks_decorator_kwargs:
                        check_setup_item["registered_kwargs"] = checks_decorator_kwargs
