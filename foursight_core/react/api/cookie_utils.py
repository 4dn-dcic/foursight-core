import datetime
from typing import Any, Optional
from http.cookies import SimpleCookie
from dcicutils.misc_utils import str_to_bool
from .datetime_utils import (
    convert_time_t_to_datetime,
    convert_utc_datetime_to_cookie_expires_format,
    EPOCH
)
from .misc_utils import is_running_locally


def read_cookie(request: dict, cookie_name: str) -> Optional[str]:
    """
    Returns the value of the cookie of the given name from within the given request,
    or None if it does not exist.
    """
    if not cookie_name or not request:
        return ""
    simple_cookies = _read_cookies(request)
    cookie_morsel = simple_cookies.get(cookie_name) if simple_cookies else None
    return cookie_morsel.value if cookie_morsel else None


def read_cookie_bool(request: dict, cookie_name: str) -> bool:
    """
    Returns the value of the cookie of the given name from within the given request,
    as a bool (per dcicutils.str_to_bool), or False if the cookie does not exist
    or is not a value True specifier.
    """
    result = str_to_bool(read_cookie(request, cookie_name))
    return True if result else False


def read_cookie_int(request: dict, cookie_name: str, default: int = 0) -> int:
    """
    Returns the value of the cookie of the given name from within the given request,
    as an integer, or the given default value (which defaults to 0) if the cookie
    does not exist or is not a value a valid integer.
    """
    value = read_cookie(request, cookie_name)
    if not value:
        return default
    if value.startswith("-"):
        value = value[1:]
        multiplier = -1
    else:
        multiplier = 1
    if not value.isdigit():
        return default
    return int(value) * multiplier


def _read_cookies(request: dict) -> Optional[SimpleCookie]:
    """
    Returns the cookies from the given request as a SimpleCookie object.
    """
    if not request:
        return None
    cookies = request.get("headers", {}).get("cookie")
    if not cookies:
        return None
    simple_cookies = SimpleCookie()
    simple_cookies.load(cookies)
    return simple_cookies


def create_set_cookie_string(request: dict, name: str, value: Optional[str],
                             domain: str, path: str = "/", expires: Optional[Any] = None,
                             http_only: bool = False) -> str:
    """
    Returns a string suitable for an HTTP response to set a cookie for this given cookie info.
    If the given expires arg is "now" then the expiration time for the cookie will be set
    to the epoch (i.e. 1970-01-01 00:00:00) indicating it has expired; used to delete cookie.
    """
    if not name or not request:
        return ""
    cookie = name + "=" + (value if value else "") + ";"
    if domain and not is_running_locally(request):
        # N.B. When running on localhost cookies cannot be set unless we leave off the domain entirely.
        # https://stackoverflow.com/questions/1134290/cookies-on-localhost-with-explicit-domain
        cookie += f" Domain={domain};"
    if not path:
        path = "/"
    cookie += f" Path={path};"
    if expires:
        if isinstance(expires, datetime.datetime):
            expires = expires.strftime("%a, %d %b %Y %H:%M:%S GMT")
        elif isinstance(expires, int):
            expires = convert_time_t_to_datetime(expires)
            expires = expires.strftime("%a, %d %b %Y %H:%M:%S GMT")
        elif isinstance(expires, str):
            if expires.lower() == "now":
                expires = f"Expires={convert_utc_datetime_to_cookie_expires_format(EPOCH)}"
        else:
            expires = None
        if expires:
            cookie += f" Expires={expires};"
    if http_only:
        cookie += " HttpOnly;"
    return cookie


def create_delete_cookie_string(request: dict, name: str, domain: str, path: str = "/") -> str:
    return create_set_cookie_string(request, name=name, value=None, domain=domain, path=path, expires="now")
