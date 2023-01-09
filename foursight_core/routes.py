from chalice import Response
import json
from .app import app
from .route_prefixes import *


class Routes:

    def __init__(self):
        super(Routes, self).__init__()

    # ----------------------------------------------------------------------------------------------
    # Foursight Original routes.
    # ----------------------------------------------------------------------------------------------

    @staticmethod
    @app.route("/callback")
    def route_auth0_callback():
        """
        Special callback route, only to be used as a callback from Auth0
        Will return a redirect to view on error/any missing callback info.

        Note we do NOT prefix this with ROUTE_PREFIX (which is /api for local deployment only,
        and just / for normal deployment, though it is implicitly /api for this case via AWS
        lambda/chalice configuration) as with other endpoints, because Auth0 is configured,
        for local deployement, to be cognizant only of http://localhost:8000/callback.
        For normal deployment, Auth0 config is cognizant of each of the Foursight instances
        we have, e.g. https://cm3dqx36s7.execute-api.us-east-1.amazonaws.com/api/callback.
        """
        request = app.current_request
        # Note that we login to the default environment.
        return app.core.auth0_callback(request, app.core.get_default_env())

#   if ROUTE_PREFIX != ROUTE_EMPTY_PREFIX:
#       @staticmethod
#       @app.route("/", methods=['GET'])
#       def index_chalice_local():
#           """
#           Redirect with 302 to view page of DEFAULT_ENV
#           Non-protected route
#           """
#           redirect_path = ROUTE_PREFIX + 'view/' + app.core.get_default_env()
#           resp_headers = {'Location': redirect_path}
#           return Response(status_code=302, body=json.dumps(resp_headers), headers=resp_headers)

#   @staticmethod
#   @app.route(ROUTE_EMPTY_PREFIX, methods=['GET'])
#   def index():
#       """
#       Redirect with 302 to view page of DEFAULT_ENV
#       Non-protected route
#       """
#       redirect_path = ROUTE_PREFIX_EXPLICIT + 'view/' + app.core.get_default_env()
#       headers = {'Location': redirect_path}
#       return Response(status_code=302, body=json.dumps(headers), headers=headers)

    @staticmethod
    @app.route(ROUTE_PREFIX + "view", methods=['GET'])
    def route_view():
        redirect_path = ROUTE_PREFIX_EXPLICIT + 'view/' + app.core.get_default_env()
        headers = {"Location": redirect_path}
        return Response(status_code=302, body=json.dumps(headers), headers=headers)

    @staticmethod
    @app.route(ROUTE_PREFIX + 'introspect', methods=['GET'])
    def introspect(environ):
        """
        Test route
        """
        auth = app.core.check_authorization(app.current_request.to_dict(), environ)
        if auth:
            return Response(status_code=200, body=json.dumps(app.current_request.to_dict()))
        else:
            return app.core.forbidden_response()

    @staticmethod
    @app.route(ROUTE_PREFIX + 'view_run/{environ}/{check}/{method}', methods=['GET'])
    def view_run_route(environ, check, method):
        """
        Protected route
        """
        req_dict = app.current_request.to_dict()
        domain, context = app.core.get_domain_and_context(req_dict)
        query_params = req_dict.get('query_params', {})
        if app.core.check_authorization(req_dict, environ):
            if method == 'action':
                return app.core.view_run_action(environ, check, query_params, context)
            else:
                return app.core.view_run_check(environ, check, query_params, context)
        else:
            return app.core.forbidden_response(context)

    @staticmethod
    @app.route(ROUTE_PREFIX + 'view/{environ}', methods=['GET'])
    def view_route(environ):
        """
        Non-protected route
        """
        req_dict = app.current_request.to_dict()
        domain, context = app.core.get_domain_and_context(req_dict)
        return app.core.view_foursight(app.current_request, environ, app.core.check_authorization(req_dict, environ), domain, context)

    @staticmethod
    @app.route(ROUTE_PREFIX + 'view/{environ}/{check}/{uuid}', methods=['GET'])
    def view_check_route(environ, check, uuid):
        """
        Protected route
        """
        req_dict = app.current_request.to_dict()
        domain, context = app.core.get_domain_and_context(req_dict)
        if app.core.check_authorization(req_dict, environ):
            return app.core.view_foursight_check(app.current_request, environ, check, uuid, True, domain, context)
        else:
            return app.core.forbidden_response()

    @staticmethod
    @app.route(ROUTE_PREFIX + 'history/{environ}/{check}', methods=['GET'])
    def history_route(environ, check):
        """
        Non-protected route
        """
        # get some query params
        req_dict = app.current_request.to_dict()
        query_params = req_dict.get('query_params')
        start = int(query_params.get('start', '0')) if query_params else 0
        limit = int(query_params.get('limit', '25')) if query_params else 25
        domain, context = app.core.get_domain_and_context(req_dict)
        return app.core.view_foursight_history(app.current_request, environ, check, start, limit,
                                      app.core.check_authorization(req_dict, environ), domain, context)

    @staticmethod
    @app.route(ROUTE_PREFIX + 'checks/{environ}/{check}/{uuid}', methods=['GET'])
    def get_check_with_uuid_route(environ, check, uuid):
        """
        Protected route
        """
        if app.core.check_authorization(app.current_request.to_dict(), environ):
            return app.core.run_get_check(environ, check, uuid)
        else:
            return app.core.forbidden_response()

    @staticmethod
    @app.route(ROUTE_PREFIX + 'checks/{environ}/{check}', methods=['GET'])
    def get_check_route(environ, check):
        """
        Protected route
        """
        if app.core.check_authorization(app.current_request.to_dict(), environ):
            return app.core.run_get_check(environ, check, None)
        else:
            return app.core.forbidden_response()

    @staticmethod
    @app.route(ROUTE_PREFIX + 'checks/{environ}/{check}', methods=['PUT'])
    def put_check_route(environ, check):
        """
        Take a PUT request. Body of the request should be a json object with keys
        corresponding to the fields in CheckResult, namely:
        title, status, description, brief_output, full_output, uuid.
        If uuid is provided and a previous check is found, the default
        behavior is to append brief_output and full_output.

        Protected route
        """
        request = app.current_request
        if app.core.check_authorization(request.to_dict(), environ):
            put_data = request.json_body
            return app.core.run_put_check(environ, check, put_data)
        else:
            return app.core.forbidden_response()

# Commented out based on feedback PR-33 from Will ...
# As it is incompatible with EnvUtils at this time.
# TODO: Create a ticket explaining the environment need.
#
#   @staticmethod
#   @app.route(ROUTE_PREFIX + 'environments/{environ}', methods=['PUT'])
#   def put_environment(environ):
#       """
#       Take a PUT request that has a json payload with 'fourfront' (ff server)
#       and 'es' (es server).
#       Attempts to generate an new environment and runs all checks initially
#       if successful.
#
#       Protected route
#       """
#       request = app.current_request
#       if app.core.check_authorization(request.to_dict(), environ):
#           env_data = request.json_body
#           return app.core.run_put_environment(environ, env_data)
#       else:
#           return app.core.forbidden_response()

    @staticmethod
    @app.route(ROUTE_PREFIX + 'environments/{environ}', methods=['GET'])
    def get_environment_route(environ):
        """
        Protected route
        """
        if app.core.check_authorization(app.current_request.to_dict(), environ):
            return app.core.run_get_environment(environ)
        else:
            return app.core.forbidden_response()

# Commented out based on feedback PR-33 from Will ...
# As it is incompatible with EnvUtils at this time.
# Can create a ticket to make it compatible in the future.
# TODO: Create a ticket explaining the environment need.
#
#   @staticmethod
#   @app.route(ROUTE_PREFIX + 'environments/{environ}/delete', methods=['DELETE'])
#   def delete_environment(environ):
#       """
#       Takes a DELETE request and purges the foursight environment specified by 'environ'.
#       NOTE: This only de-schedules all checks, it does NOT wipe data associated with this
#       environment - that can only be done directly from S3 (for safety reasons).
#
#       Protected route
#       """
#       if app.core.check_authorization(app.current_request.to_dict(), environ):  # TODO (C4-138) Centralize authorization check
#           return app.core.run_delete_environment(environ)
#       else:
#           return app.core.forbidden_response()

    # dmichaels/2022-07-31:
    # For testing/debugging/troubleshooting.
    @staticmethod
    @app.route(ROUTE_PREFIX + 'info/{environ}', methods=['GET'])
    def get_view_info_route(environ):
        req_dict = app.current_request.to_dict()
        domain, context = app.core.get_domain_and_context(req_dict)
        return app.core.view_info(request=app.current_request, environ=environ, is_admin=app.core.check_authorization(req_dict, environ), domain=domain, context=context)

    @staticmethod
    @app.route(ROUTE_PREFIX + 'users/{environ}/{email}')
    def get_view_user_route(environ, email):
        req_dict = app.current_request.to_dict()
        domain, context = app.core.get_domain_and_context(req_dict)
        return app.core.view_user(request=app.current_request, environ=environ, is_admin=app.core.check_authorization(req_dict, environ), domain=domain, context=context, email=email)

    @staticmethod
    @app.route(ROUTE_PREFIX + 'users/{environ}')
    def get_view_users_route(environ):
        req_dict = app.current_request.to_dict()
        domain, context = app.core.get_domain_and_context(req_dict)
        return app.core.view_users(request=app.current_request, environ=environ, is_admin=app.core.check_authorization(req_dict, environ), domain=domain, context=context)
