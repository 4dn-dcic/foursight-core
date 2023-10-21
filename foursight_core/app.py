from chalice import Chalice
from json import loads as load_json
from typing import Optional


app = Chalice(app_name='foursight-core')
app.request = lambda: app.current_request.to_dict()
app.request_args = lambda: app.request().get("query_params", {}) or {}
app.request_arg = lambda name, fallback = None: app.request_args().get(name, fallback)
app.request_arg_int = lambda name, fallback = 0: parse_int(app.request_arg(name), fallback)
app.request_arg_bool = lambda name, fallback = False: parse_bool(app.request_arg(name), fallback)
app.request_body = lambda: load_json(app.current_request.raw_body.decode())
app.request_method = lambda: app.current_request.method.upper()


def parse_int(value: Optional[str], fallback: int = 0) -> int:
    try:
        return int(value) if value else fallback
    except ValueError:
        return fallback


def parse_bool(value: Optional[str], fallback: int = 0) -> int:
    try:
        return value.lower() == "true" if value else fallback
    except ValueError:
        return fallback
