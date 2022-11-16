from chalice.app import Request
import json
from typing import Optional
from urllib.parse import urlparse

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
    return request.get("query_params", {})


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
        return url.scheme + "://" + url.hostname + (":" + str(url.port) if url.port else "")
    except Exception:
        return ""


def is_running_locally(request: dict) -> bool:
    """
    Returns true iff the given request indicates that we are running locally (localhost).
    """
    return request.get("context", {}).get("identity", {}).get("sourceIp", "") == "127.0.0.1"
