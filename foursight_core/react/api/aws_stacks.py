import boto3
from .datetime_utils import convert_datetime_to_utc_datetime_string
from .yaml_utils import load_yaml
from collections import OrderedDict
from dcicutils.function_cache_decorator import function_cache
from dcicutils.obfuscation_utils import obfuscate_dict
from typing import Optional, Union


_STACK_NAME_PREFIX = "c4-"


@function_cache
def aws_get_stacks() -> list:
    """
    Returns the list of all known AWS CloudFormation stacks with various metadata.
    """
    def stack_id(element):
        return element.name
    stacks_info = []
    cf = boto3.resource("cloudformation")
    for stack in sorted(cf.stacks.all(), key=stack_id):
        if stack.name.startswith(_STACK_NAME_PREFIX):
            stacks_info.append(_create_aws_stack_info(stack))
    return stacks_info


def _create_aws_stack_info(stack: object):
    """
    Returns the given boto3 format AWS stack info in our canonical form.
    """
    return {
        "name": stack.name,
        "id": stack.stack_id,
        "description": stack.description,
        "role_arn": stack.role_arn,
        "status": stack.stack_status,
        "updated": convert_datetime_to_utc_datetime_string(stack.last_updated_time),
        "created": convert_datetime_to_utc_datetime_string(stack.creation_time)
    }


@function_cache
def aws_get_stack(stack_name_or_object: Union[str, object]) -> dict:
    """
    Returns all detailed info for the given AWS CloudFormation stack name,
    including various metadata, outputs, parameters, and resources.
    Output and parameter values are obfuscated if their names represents a sensitive value.
    """
    result = {}
    stack = _get_aws_stack_object(stack_name_or_object)
    if stack:
        result = _create_aws_stack_info(stack)
        outputs = aws_get_stack_outputs(stack)
        parameters = aws_get_stack_parameters(stack)
        resources = aws_get_stack_resources(stack)
        result["outputs"] = outputs
        result["parameters"] = parameters
        result["resources"] = resources
    return result


@function_cache
def aws_get_stack_outputs(stack_name_or_object: Union[str, object]) -> dict:
    """
    Returns the name/value outputs for the given AWS CloudFormation stack name.
    Output values are obfuscated if the output name represents a sensitive value.
    """
    def output_id(element):
        return element["OutputKey"]
    result = {}
    stack = _get_aws_stack_object(stack_name_or_object)
    if stack and stack.outputs:
        for stack_output in sorted(stack.outputs, key=output_id):
            result[stack_output.get("OutputKey")] = stack_output.get("OutputValue")
    return _obfuscate(result)


@function_cache
def aws_get_stack_parameters(stack_name_or_object: Union[str, object]) -> dict:
    """
    Returns a name/value dictionary of the parameters for the given AWS CloudFormation stack name.
    Parameter values are obfuscated if the parameter name represents a sensitive value.
    """
    def parameter_id(element):
        return element["ParameterKey"]
    result = {}
    stack = _get_aws_stack_object(stack_name_or_object)
    if stack and stack.parameters:
        for stack_parameter in sorted(stack.parameters, key=parameter_id):
            result[stack_parameter.get("ParameterKey")] = stack_parameter.get("ParameterValue")
    return _obfuscate(result)


@function_cache
def aws_get_stack_resources(stack_name_or_object: Union[str, object]) -> dict:
    """
    Returns a name/value dictionary of the resources for the given AWS CloudFormation stack name.
    """
    def resource_id(element):
        return element.logical_resource_id
    result = {}
    stack = _get_aws_stack_object(stack_name_or_object)
    if stack:
        for stack_resource in sorted(list(stack.resource_summaries.all()), key=resource_id):
            result[stack_resource.logical_resource_id] = stack_resource.resource_type
    return _obfuscate(result)


def _get_aws_stack_object(stack_name_or_object: Union[str, object]) -> Optional[object]:
    """
    Returns the boto3 Cloudformation stack object for the given stack name, if the given argument
    is a string, or if the given argument is already a boto3 stack object, then return that value.
    :param stack_name_or_object: String representing Cloudformation stack name or boto3 stack object.
    :returns: The boto3 Cloudformation stack object or None if not found.
    """
    if type(stack_name_or_object).__name__ == "cloudformation.Stack":
        return stack_name_or_object
    elif not isinstance(stack_name_or_object, str):
        return None
    cf = boto3.resource("cloudformation")
    stack = list(cf.stacks.filter(StackName=stack_name_or_object))
    return get_single_item_list_value(stack)
    # return stack[0] if len(stack) == 1 else None


def get_single_item_list_value(any_list: list) -> object:
    if len(any_list) != 1:
        raise Exception(f"Single item list expected but contains {len(any_list)}")
    return any_list[0]


@function_cache
def aws_get_stack_template(stack_name: str) -> dict:
    """
    Returns the AWS Cloudformation template as a dictionary for the given stack name.
    The entire template will be obfuscated according to the obfuscate_dict function.
    """
    cf = boto3.client("cloudformation")
    stack_template = cf.get_template(StackName=stack_name)
    stack_template_body = stack_template["TemplateBody"]
    if isinstance(stack_template_body, dict) or isinstance(stack_template_body, OrderedDict):
        #
        # For some reason for our AWS stack c4-foursight-cgap-supertest-stack
        # in particular, we get back an OrderedDict rather than the usual string.
        #
        stack_template_dict = stack_template_body
    else:
        #
        # For other AWS stacks like c4-datastore-cgap-supertest-stack,
        # we get a simple string containing the YAML for the template.
        #
        stack_template_dict = load_yaml(stack_template_body)
    return _obfuscate(stack_template_dict)


def _obfuscate(value: dict) -> dict:
    return obfuscate_dict(value, obfuscated="********")
