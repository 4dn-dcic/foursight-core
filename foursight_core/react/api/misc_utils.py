from chalice.app import Request
from functools import lru_cache
import inspect
import json
import os
import pkg_resources
import sys
from typing import Callable, Optional, Tuple, Union
from urllib.parse import urlparse

memoize = lru_cache(100)

def sort_dictionary_by_case_insensitive_keys(dictionary: dict) -> dict:
    """
    Returns the given dictionary sorted by (case-insenstivie) key values; yes,
    dictionaries are ordered as of Python 3.7. If the given value is not a
    dictionary it will be coerced to one.
    :param dictionary: Dictionary to sort.
    :return: Given dictionary sorted by key value.
    """
    if not dictionary or not isinstance(dictionary, dict):
        return {}
    return {key: dictionary[key] for key in sorted(dictionary.keys(), key=lambda key: key.lower())}


def get_request_domain(request: dict) -> str:
    return request.get("headers", {}).get("host")


def get_request_args(request: dict) -> dict:
    return request.get("query_params") or {}


def get_request_arg(request: dict, name: str) -> Optional[str]:
    """
    Returns the value of the given URL query parameter name for the given request;
    returns None if not present. Note if present but with no value, then and empty
    string is returned, e.g. for http://localhost:8000/callback?react if "react"
    is queried then returns an empty string, and not None.
    """
    return get_request_args(request).get(name, None)


def get_request_body(request: Request) -> dict:
    return json.loads(request.raw_body.decode())


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
    if package == "foursight-core" or package =="foursight_core":
        package_source = "foursight-core"
        package_target = "foursight_core"
        repo_org = "4dn-dcic"
    elif package == "foursight-cgap" or package == "chalicelib_cgap":
        package_source = "foursight-cgap"
        package_target = "chalicelib_cgap"
        repo_org = "dbmi-bgm"
    elif package == "foursight" or package == "chalicelib_fourfront":
        package_source = "foursight"
        package_target = "chalicelib_fourfront"
        repo_org = "4dn-dcic"
    elif package == "dcicutils" or package == "utils":
        package_source = "utils"
        package_target = "dcicutils"
        repo_org = "4dn-dcic"
    else:
        return None
    try:
        version = f"v{pkg_resources.get_distribution(package_source).version}"
    except Exception as e:
        return None
    repo_url = f"{github_url}/{repo_org}/{package_source}"
    if not file:
        return f"{repo_url}/releases/tag/{version}"
    if os.path.isabs(file):
        path = os.path.normpath(file).split(os.sep)
        for i in range(len(path)):
            if path[i] == package_target:
                if i < len(path) - 1:
                    file = "/".join(path[i + 1:])
                    break;
            if file.startswith(os.sep):
                file = file[len(os.sep):]
    line = f"#L{line}" if line > 0 else ""
    return f"{repo_url}/blob/{version}/{package_target}/{file}{line}"


def is_running_locally(request: dict) -> bool:
    """
    Returns true iff the given request indicates that we are running locally (localhost).
    """
    return request.get("context", {}).get("identity", {}).get("sourceIp", "") == "127.0.0.1"

def import_function(fully_qualified_function_name: str) -> Optional[Callable]:
    try:
        module_name, unit_name = fully_qualified_function_name.rsplit(".", 1)
        return getattr(__import__(module_name, fromlist=[""]), unit_name)
    except:
        return None

def get_function_info(func: Union[str, Callable]) -> Optional[Tuple[str, str, str, str, int, str]]:
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
    except Exception as e:
        print('xyzzy/get_function_info/exception')
        print(e)
    func_github_url = get_github_url(func_package, func_file, func_line)
    return func_name, func_file, func_module, func_package, func_line, func_github_url
