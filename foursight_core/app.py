from json import loads as load_json
from typing import Optional
from chalice import Chalice
app = Chalice(app_name='foursight-core')
app.request = lambda: app.current_request.to_dict()
app.request_args = lambda: app.request().get("query_params", {}) or {}
app.request_arg = lambda name, default = None: app.request_args().get(name, default)
app.request_body = lambda: load_json(app.current_request.raw_body.decode())
app.request_method = lambda: app.current_request.method.upper()
