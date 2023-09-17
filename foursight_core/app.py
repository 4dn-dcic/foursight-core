from typing import Optional
from chalice import Chalice
app = Chalice(app_name='foursight-core')
app.request_args = lambda: app.current_request.to_dict().get("query_params", {})
app.request_arg = lambda name, default = None: app.current_request.to_dict().get("query_params", {}).get(name, default)
app.request = lambda: app.current_request
