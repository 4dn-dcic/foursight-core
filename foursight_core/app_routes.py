from chalice import Chalice
from .app_utils import AppUtilsCore
app = Chalice(app_name='foursight-cgap')

class AppUtils(AppUtilsCore):
    APP_PACKAGE_NAME = "foursight-core"

app_utils_core = AppUtils()
ROUTE_PREFIX = "/api/"
CORS = False

class XYZZY2:
    print('XYZZY:UNIFY-EXPERIMENT:CLASS-2')
    def __init__(self):
        print('XYZZY:UNIFY-EXPERIMENT:XYZZY/CTOR-2')

    @staticmethod
    @app.route(ROUTE_PREFIX + 'reactxyzzy2/{environ}/xyzzy2', methods=["GET"], cors=CORS)
    def react_route_xyzzy2(environ):
        print(f"XYZZY:UNIFY-EXPERIMENT-2:/reactapixyzzy2/{environ}/xyzzy2")
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app_utils_core.get_domain_and_context(request_dict)
        return app_utils_core.react_get_header_info(request=request, environ=environ, domain=domain, context=context)

@app.route(ROUTE_PREFIX + 'reactxyzzyabc/{environ}/xyzzyabc', methods=["GET"], cors=CORS)
def react_route_xyzzyabc(environ):
    print(f"XYZZY:UNIFY-EXPERIMENT-2:/reactapixyzzyabc/{environ}/xyzzyabc")
    request = app.current_request
    request_dict = request.to_dict()
    domain, context = app_utils_core.get_domain_and_context(request_dict)
    return app_utils_core.react_get_header_info(request=request, environ=environ, domain=domain, context=context)
