import datetime
from typing import Any, Optional
from http.cookies import SimpleCookie
from .datetime_utils import convert_time_t_to_datetime


def read_cookie(request: dict, cookie_name: str) -> str:
    if not cookie_name or not request:
        return ""
    simple_cookies = read_cookies(request)
    return simple_cookies.get(cookie_name)


def read_cookies(request: dict) -> dict:
    if not request:
        return {}
    cookies = request.get("headers", {}).get("cookie")
    if not cookies:
        return {}
    simple_cookies = SimpleCookie()
    simple_cookies.load(cookies)
    return {key: value.value for key, value in simple_cookies.items()}


def create_set_cookie_string(request: dict, name: str, value: Optional[str],
                             domain: str, path: str = "/", expires: Optional[Any] = None, http_only: bool = False) -> str:
    """
    Returns a string suitable for an HTTP response to set a cookie for this given cookie info.
    If the given expires arg is "now" then then the expiration time for the cookie will be
    set to the epoch (i.e. 1970-01-01) indicating this it has expired; used effectively for delete.
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
            #expires = (datetime.datetime.utcnow() + datetime.timedelta(seconds=expires)).strftime("%a, %d %b %Y %H:%M:%S GMT")
            expires = convert_time_t_to_datetime(expires)
            expires = expires.strftime("%a, %d %b %Y %H:%M:%S GMT")
        elif isinstance(expires, str):
            if expires.lower() == "now":
                expires = "Expires=Thu, 01 Jan 1970 00:00:00 UTC"
        else:
            expires = None
        if expires:
            cookie += f" Expires={expires};"
    if http_only:
        cookie += " HttpOnly;"
    return cookie


def create_delete_cookie_string(request: dict, name: str, domain: str, path: str = "/") -> str:
    return create_set_cookie_string(request, name=name, value=None, domain=domain, path=path, expires="now")


def is_running_locally(request_dict) -> bool:
    return request_dict.get('context', {}).get('identity', {}).get('sourceIp', '') == "127.0.0.1"
