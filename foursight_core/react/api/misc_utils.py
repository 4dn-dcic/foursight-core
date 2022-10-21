from typing import Optional

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


def get_request_arg(request: dict, name: str) -> Optional[str]:
    """
    Returns the value of the given URL query parameter name for the given request;
    returns None if not present. Note if present but with no value, then and empty
    string is returned, e.g. for http://localhost:8000/callback?react if "react"
    is queried then returns an empty string, and not None.
    """
    query_params = request.get("query_params")
    return query_params.get(name, None) if query_params else None


def is_running_locally(request: dict) -> bool:
    """
    Returns true iff the given request indicates that we are running locally (localhost).
    """
    return request.get("context", {}).get("identity", {}).get("sourceIp", "") == "127.0.0.1"
