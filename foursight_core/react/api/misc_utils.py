from chalice.app import Request
from typing import Dict, List
import inspect
import json
import os
import pkg_resources
import sys
from typing import Any, Callable, Optional, Tuple, Union
from urllib.parse import urlparse
from dcicutils.task_utils import pmap


def sort_dictionary_by_case_insensitive_keys(dictionary: Dict) -> Dict:
    """
    Returns the given dictionary sorted by (case-insenstivie) key values; yes,
    dictionaries are ordered as of Python 3.7. If the given value is not a
    dictionary it will be coerced to one.
    :param dictionary: Dictionary to sort.
    :return: Given dictionary sorted by key value.
    """
    if not dictionary or not isinstance(dictionary, Dict):
        return {}
    return {key: dictionary[key] for key in sorted(dictionary.keys(), key=lambda key: key.lower())}


def get_request_domain(request: Dict) -> str:
    return request.get("headers", {}).get("host")


def get_request_args(request: Dict) -> Dict:
    return request.get("query_params") or {}


def get_request_arg(request: Dict, name: str) -> Optional[str]:
    """
    Returns the value of the given URL query parameter name for the given request;
    returns None if not present. Note if present but with no value, then and empty
    string is returned, e.g. for http://localhost:8000/callback?react if "react"
    is queried then returns an empty string, and not None.
    """
    return get_request_args(request).get(name, None)


def get_request_body(request: Request) -> Dict:
    return json.loads(request.raw_body.decode())


def get_request_origin(request: Dict) -> str:
    headers = request.get("headers", {})
    scheme = headers.get("x-forwarded-proto", "http" if is_running_locally(request) else "https")
    domain = headers.get("host")
    return f"{scheme}://{domain}"


def get_base_url(url: str) -> str:
    """
    Returns the base (root) URL if the given URL, i.e. with just the scheme/protocol (e.g.
    http:// or https://), and the the domain, and port if any. Any credentials (username,
    password) in the URL (e.g. http:) will NOT be included. For example, given this:
    https://username:password@example.com/api/react/cgap-supertest/home?arg=12345678
    this function returns this: https://example.com
    """
    try:
        url = urlparse(url)
        scheme = url.scheme
        hostname = url.hostname
        port = url.port
        port = '' if (port == 80 and scheme == 'http') or (port == 443 and scheme == 'https') else port
        return scheme + "://" + hostname + (":" + str(port) if port else "")
    except Exception:
        return ""


def get_github_url(package: str, file: Optional[str] = None, line: Optional[int] = None) -> Optional[str]:
    """
    Returns the GitHub URL to the given package, with the appropriate/current version.
    Only these packages are supported: foursight-core, foursight-cgap, foursight, dcicutils
    If the optional file argument is given then returns the versionsed GitHub URL to that file.
    This is to provide convenience GitHub links to the foursight (e.g. checks) source code in the UI.
    TODO: Seems like there should be a better more programmatic way to determine this.
    """
    github_url = "https://github.com"
    if package == "foursight_core":
        package_source = "foursight-core"
        package_target = "foursight_core"
        repo_org = "4dn-dcic"
    elif package == "chalicelib_cgap":
        package_source = "foursight-cgap"
        package_target = "chalicelib_cgap"
        repo_org = "dbmi-bgm"
    elif package == "chalicelib_fourfront":
        package_source = "foursight"
        package_target = "chalicelib_fourfront"
        repo_org = "4dn-dcic"
    elif package == "dcicutils":
        package_source = "utils"
        package_target = "dcicutils"
        repo_org = "4dn-dcic"
    else:
        return None
    try:
        version = f"v{pkg_resources.get_distribution(package_source).version}"
    except Exception:
        return None
    repo_url = f"{github_url}/{repo_org}/{package_source}"
    if not file:
        # Note we assume tagged version in GitHub.
        return f"{repo_url}/releases/tag/{version}"
    if os.path.isabs(file):
        path = os.path.normpath(file).split(os.sep)
        for i in range(len(path)):
            if path[i] == package_target:
                if i < len(path) - 1:
                    file = "/".join(path[i + 1:])
                    break
            if file.startswith(os.sep):
                file = file[len(os.sep):]
    line = f"#L{line}" if line > 0 else ""
    return f"{repo_url}/blob/{version}/{package_target}/{file}{line}"


def is_running_locally(request: Dict) -> bool:
    """
    Returns true iff the given request indicates that we are running locally (localhost).
    """
    return request.get("context", {}).get("identity", {}).get("sourceIp", "") == "127.0.0.1"


def get_function_info(func: Union[str, Callable]) -> Optional[Tuple[str, str, str, str, int, str]]:
    """
    Returns a tuple containing, in order, these function properties of the given function by
    function name or object: name, file, module, package, line number, GitHub link (only
    if one of these repos: foursight-core, foursight-cgap, foursight, dcicutils)
    Currently used only for informational purposes in the React UI to display
    information about code for checks and actions and their GitHub links.
    """
    def import_function(fully_qualified_function_name: str) -> Optional[Callable]:
        try:
            module_name, unit_name = fully_qualified_function_name.rsplit(".", 1)
            return getattr(__import__(module_name, fromlist=[""]), unit_name)
        except:
            return None
    func_name = None
    func_file = None
    func_module = None
    func_package = None
    func_line = None
    try:
        if not isinstance(func, Callable):
            func = import_function(func)
            if getattr(func, "func"):
                func = func.func
        func_name = func.__name__
        func_module = func.__module__
        func_file = sys.modules[func_module].__file__
        _, func_line = inspect.getsourcelines(func)
        func_package = __import__(func_module).__package__
    except Exception:
        pass
    func_github_url = get_github_url(func_package, func_file, func_line)
    return func_name, func_file, func_module, func_package, func_line, func_github_url


# TODO: Included here until we get utils PR-236 approved/merged/pushed

def keys_and_values_to_dict(keys_and_values: List, key_name: str = "Key", value_name: str = "Value") -> Dict:
    """
    Transforms the given list of key/value objects, each containing a "Key" and "Value" property,
    or alternately named via the key_name and/or value_name arguments, into a simple
    dictionary of keys/values, and returns this value. For example, given this:

      [
        { "Key": "env",
          "Value": "prod"
        },
        { "Key": "aws:cloudformation:stack-name",
          "Value": "c4-network-main-stack"
        }
      ]

    This function would return this:

      {
        "env": "prod",
        "aws:cloudformation:stack-name": "c4-network-main-stack"
      }

    :param keys_and_values: List of key/value objects as described above.
    :param key_name: Name of the given key property in the given list of key/value objects; default to "Key".
    :param value_name: Name of the given value property in the given list of key/value objects; default to "Value".
    :returns: Dictionary of keys/values from given list of key/value object as described above.
    :raises ValueError: if item in list does not contain key or value name; or on duplicate key name in list.
    """
    # result = {}
    # for item in keys_and_values:
    #     key = item.get(key_name)
    #     if key:
    #         result[str(key)] = item.get(value_name)
    # return result

    result = {}
    for item in keys_and_values:
        if key_name not in item:
            raise ValueError(f"Key {key_name} is not in {item}.")
        if value_name not in item:
            raise ValueError(f"Key {value_name} is not in {item}.")
        if item[key_name] in result:
            raise ValueError(f"Key {key_name} is duplicated in {keys_and_values}.")
        result[item[key_name]] = item[value_name]
    return result


def dict_to_keys_and_values(dictionary: Dict, key_name: str = "Key", value_name: str = "Value") -> List:
    """
    Transforms the keys/values in the given dictionary to a list of key/value objects, each containing
    a "Key" and "Value" property, or alternately named via the key_name and/or value_name arguments,
    and returns this value. For example, given this:

      {
        "env": "prod",
        "aws:cloudformation:stack-name": "c4-network-main-stack"
      }

    This function would return this:

      [
        { "Key": "env",
          "Value": "prod"
        },
        { "Key": "aws:cloudformation:stack-name",
          "Value": "c4-network-main-stack"
        }
      ]

    :param dictionary: Dictionary of keys/values described above.
    :param key_name: Name of the given key property in the result list of key/value objects; default to "Key".
    :param value_name: Name of the given value property in the result list of key/value objects; default to "Value".
    :returns: List of key/value objects from the given dictionary as described above.
    """
    result = []
    for key in dictionary:
        result.append({key_name: key, value_name: dictionary[key]})
    return result


def find_common_prefix(string_list: List) -> str:
    """
    Returns the longest common initial substring among all of the strings in the given list.
    """
    if not string_list:
        return ""
    min_length = min(len(s) if s else 0 for s in string_list)
    for i in range(min_length):
        if any(string_list[j][i] != string_list[0][i] for j in range(1, len(string_list))):
            return string_list[0][:i]
    return string_list[0][:min_length]


def name_value_list_to_dict(items: List, name_property_name: str = "name", value_property_name: str = "value"):
    """
    Give a list that looks like this:

      [ { "name": "abc", "value": 123 },
        { "name": "def", "value": 456 } ]

    Returns a dictionary that looks like this:

      { "abc": 123, "def": 456 }

    If there are duplicate names then takes the value of the last one in the list.
    """
    result = {}
    for item in items:
        name = item.get(name_property_name)
        if name:
            value = item.get(value_property_name)
            result[name] = value
    return result


def run_functions_concurrently(functions: List[Callable]) -> List[Any]:
    """
    Runs the given list of functions concurrently. No arguments are passed to the function;
    so often/typically the caller passes a special wrapper function/lambda which calls
    the "real" function with the desired arguments. Returns the results of each function
    call in a list, the order of which corresponds to the order fo the given function list.
    """
    if not functions or not isinstance(functions, list):
        return []
    functions = [function if isinstance(function, Callable) else lambda: None for function in functions]
    return [result for result in pmap(lambda f: f(), functions)] if len(functions) > 1 else [functions[0]()]


run_concurrently = pmap
