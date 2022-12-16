import boto3
from .datetime_utils import convert_utc_datetime_to_useastern_datetime_string
from .misc_utils import memoize
from dcicutils.obfuscation_utils import obfuscate_dict
from typing import Optional, Union


_STACK_NAME_PREFIX = "c4-"

@memoize
def aws_get_stacks() -> list:
    """
    Returns the list of all known AWS CloudFormation stacks with various metadata.
    """
    stacks_info = []
    c4 = boto3.resource('cloudformation')
    for stack in sorted(c4.stacks.all(), key=lambda key: key.name):
        if stack.name.startswith(_STACK_NAME_PREFIX):
            stacks_info.append(_create_aws_stack_info(stack))
    return stacks_info


def _create_aws_stack_info(stack: object):
    return {
        "name": stack.name,
        "id": stack.stack_id,
        "description": stack.description,
        "role_arn": stack.role_arn,
        "status": stack.stack_status,
        "updated": convert_utc_datetime_to_useastern_datetime_string(stack.last_updated_time),
        "created": convert_utc_datetime_to_useastern_datetime_string(stack.creation_time)
    }


@memoize
def aws_get_stack(stack_name: str) -> object:
    """
    Returns all detailed info for the given AWS CloudFormation stack name,
    including various metadata, outputs, parameters, and resources.
    Output and parameter values are obfuscated if their names represents a sensitive value.
    """
    result = {}
    stack = _aws_get_stack_object(stack_name)
    if stack:
        result = {**_create_aws_stack_info(stack)}
        outputs = aws_get_stack_outputs(stack)
        parameters = aws_get_stack_parameters(stack)
        resources = aws_get_stack_resources(stack)
        result["outputs"] = outputs
        result["parameters"] = parameters
        result["resources"] = resources
        pass
    return result


@memoize
def aws_get_stack_outputs(stack_name: str) -> dict:
    """
    Returns the name/value outputs for the given AWS CloudFormation stack name.
    Output values are obfuscated if the output name represents a sensitive value.
    """
    result = {}
    stack = _aws_get_stack_object(stack_name)
    if stack and stack.outputs:
        for stack_output in sorted(stack.outputs, key=lambda key: key["OutputKey"]):
            result[stack_output.get("OutputKey")] = stack_output.get("OutputValue")
    return obfuscate_dict(result, obfuscated="********")


@memoize
def aws_get_stack_parameters(stack_name: str) -> dict:
    """
    Returns a name/value dictionary of the parameters for the given AWS CloudFormation stack name.
    Parameter values are obfuscated if the parameter name represents a sensitive value.
    """
    result = {}
    stack = _aws_get_stack_object(stack_name)
    if stack and stack.parameters:
        for stack_parameter in sorted(stack.parameters, key=lambda key: key["ParameterKey"]):
            result[stack_parameter.get("ParameterKey")] = stack_parameter.get("ParameterValue")
    return obfuscate_dict(result, obfuscated="********")


@memoize
def aws_get_stack_resources(stack_name: str) -> dict:
    """
    Returns a name/value dictionary of the resources for the given AWS CloudFormation stack name.
    """
    result = {}
    stack = _aws_get_stack_object(stack_name)
    if stack:
        for stack_resource in sorted(list(stack.resource_summaries.all()), key=lambda key: key.logical_resource_id):
            result[stack_resource.logical_resource_id] = stack_resource.resource_type
    return result


def _aws_get_stack_object(stack_name_or_object: Union[str, object]) -> Optional[object]:
    if "cloudformation.Stack" in str(type(stack_name_or_object)):  # TODO: right way to type check.
        return stack_name_or_object
    c4 = boto3.resource('cloudformation')
    stack = list(c4.stacks.filter(StackName=stack_name_or_object))
    return stack[0] if len(stack) == 1 else None


def aws_stacks_cache_clear() -> None:
    aws_get_stacks.cache_clear()
    aws_get_stack.cache_clear()
    aws_get_stack_outputs.cache_clear()
    aws_get_stack_parameters.cache_clear()
    aws_get_stack_resources.cache_clear()
