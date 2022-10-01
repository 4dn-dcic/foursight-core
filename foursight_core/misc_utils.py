def sort_dictionary_by_lowercase_keys(dictionary: dict) -> dict:
    """
    Returns the given dictionary sorted by key values (yes, dictionaries are ordered as of Python 3.7).
    If the given value is not a dictionary it will be coerced to one.
    :param dictionary: Dictionary to sort.
    :return: Given dictionary sorted by key value.
    """
    if not dictionary or not isinstance(dictionary, dict):
        return {}
    return {key: dictionary[key] for key in sorted(dictionary.keys(), key=lambda key: key.lower())}