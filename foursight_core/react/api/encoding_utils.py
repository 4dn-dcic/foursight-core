import base64
import json
from typing import Union


def base64_encode(value: Union[str, dict, list]) -> str:
    if isinstance(value, dict) or isinstance(value, list):
        value = json.dumps(value)
    elif not isinstance(value, str):
        raise ValueError("Invalid argument to base64_encode; must be string, dict, or bytes.")
    return base64_encode_to_bytes(value).decode("utf-8")


def base64_decode(value: Union[str, bytes]) -> str:
    return base64_decode_to_bytes(value).decode("utf-8")


def base64_decode_to_json(value: str) -> Union[dict, list, str, int, float, bool]:
    return json.loads(base64_decode(value))


def base64_encode_to_bytes(string_or_bytes: Union[str, bytes]) -> bytes:
    if isinstance(string_or_bytes, str):
        return base64.b64encode(string_to_bytes(string_or_bytes))
    elif isinstance(string_or_bytes, bytes):
        return base64.b64encode(string_or_bytes)
    else:
        raise ValueError("Invalid argument to base64_encode_to_bytes; must be string or bytes.")


def base64_decode_to_bytes(string_or_bytes: Union[str, bytes]) -> bytes:
    if isinstance(string_or_bytes, str):
        return base64.b64decode(string_to_bytes(string_or_bytes))
    elif isinstance(string_or_bytes, bytes):
        return base64.b64decode(string_or_bytes)
    else:
        raise ValueError("Invalid argument to base64_decode_to_bytes; must be string or bytes.")


def string_to_bytes(value: str) -> bytes:
    if isinstance(value, str):
        return value.encode("utf-8")
    else:
        raise ValueError("Invalid argument to string_to_bytes; must be string.")


def bytes_to_string(value: bytes) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8") if isinstance(value, bytes) else ""
    else:
        raise ValueError("Invalid argument to bytes_to_string; must be bytes.")
