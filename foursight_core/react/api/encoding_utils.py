import base64
import json


def base64_encode(value) -> str:
    if not value:
        return ""
    if isinstance(value, dict) or isinstance(value, list):
        value = json.dumps(value)
    return base64_encode_to_bytes(value).decode("utf-8")


def base64_decode(value: str) -> str:
    if not value:
        return ""
    return base64_decode_to_bytes(value).decode("utf-8")


def base64_encode_to_bytes(string_or_bytes) -> bytes:
    if isinstance(string_or_bytes, str):
        return base64.b64encode(string_to_bytes(string_or_bytes))
    elif isinstance(string_or_bytes, bytes):
        return base64.b64encode(string_or_bytes)
    else:
        return bytes("", "utf-8")


def base64_decode_to_bytes(string_or_bytes) -> bytes:
    if isinstance(string_or_bytes, str):
        return base64.b64decode(string_to_bytes(string_or_bytes))
    elif isinstance(string_or_bytes, bytes):
        return base64.b64decode(string_or_bytes)
    else:
        return bytes("", "utf-8")


def string_to_bytes(value: str) -> bytes:
    return value.encode("utf-8") if isinstance(value, str) else "".encode("utf-8")


def bytes_to_string(value: bytes) -> str:
    return value.decode("utf-8") if isinstance(value, bytes) else ""
