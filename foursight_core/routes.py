from chalice import Response
# xyzzy
from chalice import Chalice, CORSConfig
import base64
import jinja2
import json
import os
from os.path import dirname
import jwt
import boto3
import datetime
import ast
import copy
from http.cookies import SimpleCookie
import pkg_resources
import platform
# TODO: do not import start import specific thing which i think is triple_des
from pyDes import *
import pytz
import requests
import socket
import string
import sys
import time
import types
import urllib.parse
import uuid
import logging
from itertools import chain
from dateutil import tz
from dcicutils import ff_utils
from dcicutils.env_utils import (
    EnvUtils,
    full_env_name,
    get_foursight_bucket,
    get_foursight_bucket_prefix,
    infer_foursight_from_env,
    public_env_name,
    short_env_name,
)
from dcicutils.lang_utils import disjoined_list
from dcicutils.misc_utils import get_error_message, PRINT
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.secrets_utils import (get_identity_name, get_identity_secrets)
from typing import Optional
from .identity import apply_identity_globally
from .s3_connection import S3Connection
from .fs_connection import FSConnection
from .check_utils import CheckHandler
from .sqs_utils import SQS
from .stage import Stage
from .encryption import Encryption
from .environment import Environment
from .react_api import ReactApi
from .app_utils import app, AppUtilsCore as app_utils, DEFAULT_ENV

# XYZZY
#DEFAULT_ENV = os.environ.get("ENV_NAME", "env-name-unintialized")

# When running 'chalice local' we do not (and seemingly can not) get the same "/api" prefix
# as we see when deployed to AWS (Lambda). So we set it explicitly here if your CHALICE_LOCAL
# environment variable is set. Seems to be a known issue: https://github.com/aws/chalice/issues/838
#
# Also set CORS to True if CHALICE_LOCAL; not needed if running React (nascent support of which
# is experimental and under development in distinct branch) from Foursight directly, on the same
# port (e.g. 8000), but useful if/when running React on a separate port (e.g. 3000) via npm start
# in foursight-core/react to facilitate easy/quick development/changes directly to React code.

CHALICE_LOCAL = (os.environ.get("CHALICE_LOCAL") == "1")
if CHALICE_LOCAL:
    print("XYZZY:foursight_core:CHALICE_LOCAL!!!")
    ROUTE_PREFIX = "/api/"
    ROUTE_EMPTY_PREFIX = "/api"
    ROUTE_PREFIX_EXPLICIT = "/api/"
    #
    # Very specific requirements for running Foursight React UI/API
    # in CORS mode (i.e. UI on localhost:3000 and API on localhost:8000).
    # The allow_origin must be exact (i.e. no "*" allowed),
    # and allow_credentials must be True. And on the caller (React UI)
    # side we must include 'credentials: "include"' in the fetch.
    #
    CORS = CORSConfig(
            allow_origin='http://localhost:3000', # need this to be explicit not '*'
            allow_credentials=True, # need this
            )
else:
    print("XYZZY:foursight_core:NOT_CHALICE_LOCAL!!!")
    ROUTE_PREFIX = "/"
    ROUTE_EMPTY_PREFIX = "/"
    ROUTE_PREFIX_EXPLICIT = "/api/"
    CORS = False

# When running 'chalice local' we do not (and seemingly can not) get the same "/api" prefix
# as we see when deployed to AWS (Lambda). So we set it explicitly here if your CHALICE_LOCAL
# environment variable is set. Seems to be a known issue: https://github.com/aws/chalice/issues/838
#
# Also set CORS to True if CHALICE_LOCAL; not needed if running React (nascent support of which
# is experimental and under development in distinct branch) from Foursight directly, on the same
# port (e.g. 8000), but useful if/when running React on a separate port (e.g. 3000) via npm start
# in foursight-core/react to facilitate easy/quick development/changes directly to React code.

CHALICE_LOCAL = (os.environ.get("CHALICE_LOCAL") == "1")
if CHALICE_LOCAL:
    print("XYZZY:foursight_core:CHALICE_LOCAL!!!")
    ROUTE_PREFIX = "/api/"
    ROUTE_EMPTY_PREFIX = "/api"
    ROUTE_PREFIX_EXPLICIT = "/api/"
    #
    # Very specific requirements for running Foursight React UI/API
    # in CORS mode (i.e. UI on localhost:3000 and API on localhost:8000).
    # The allow_origin must be exact (i.e. no "*" allowed),
    # and allow_credentials must be True. And on the caller (React UI)
    # side we must include 'credentials: "include"' in the fetch.
    #
    CORS = CORSConfig(
        allow_origin='http://localhost:3000', # need this to be explicit not '*'
        allow_credentials=True, # need this
    )
else:
    print("XYZZY:foursight_core:NOT_CHALICE_LOCAL!!!")
    ROUTE_PREFIX = "/"
    ROUTE_EMPTY_PREFIX = "/"
    ROUTE_PREFIX_EXPLICIT = "/api/"
    CORS = False

class Routes:

    @app.route((ROUTE_PREFIX if not CHALICE_LOCAL else "/") + 'callback', cors=CORS)
    def auth0_callback():
        """
        Special callback route, only to be used as a callback from auth0
        Will return a redirect to view on error/any missing callback info.
        """
        print('xyzzy:route_auth0_callback-111')
        xyzzy = app.current_request.to_dict().get('headers', {})
        print(xyzzy)
        request = app.current_request
        default_env = os.environ.get("ENV_NAME", DEFAULT_ENV)
        return app_utils.singleton().auth0_callback(request, default_env)


    if ROUTE_PREFIX != ROUTE_EMPTY_PREFIX:
        @app.route("/", methods=['GET'], cors=CORS)
        def index_chalice_local():
            """
            Redirect with 302 to view page of DEFAULT_ENV
            Non-protected route
            """
            default_env = os.environ.get("ENV_NAME", DEFAULT_ENV)
            domain, context = app_utils.singleton().get_domain_and_context(app.current_request.to_dict())
            redirect_path = ROUTE_PREFIX + 'view/' + default_env
            print(f'foursight-cgap-1: Redirecting to: {redirect_path}')
            print(f'xyzzy-1: default_env = [{default_env}]')
            print(f'xyzzy-1: os.environ[ENV_NAME] = [{os.environ.get("ENV_NAME")}]')
            print(f'xyzzy-1: os.environ')
            print(os.environ)
            resp_headers = {'Location': redirect_path}
            return Response(status_code=302, body=json.dumps(resp_headers), headers=resp_headers)


    @app.route(ROUTE_EMPTY_PREFIX, methods=['GET'], cors=CORS)
    def index():
        """
        Redirect with 302 to view page of DEFAULT_ENV
        Non-protected route
        """
        default_env = os.environ.get("ENV_NAME", DEFAULT_ENV)
        domain, context = app_utils.singleton().get_domain_and_context(app.current_request.to_dict())
        redirect_path = ROUTE_PREFIX_EXPLICIT + 'view/' + default_env
        print(f'foursight-cgap-2: Redirecting to: {redirect_path}')
        print(f'xyzzy-2: os.environ[ENV_NAME] = [{os.environ.get("ENV_NAME")}]')
        print(f'xyzzy-2: default_env = [{default_env}]')
        print(f'xyzzy-2: os.environ')
        print(os.environ)
        print(context)
        headers = {'Location': redirect_path}
        return Response(status_code=302, body=json.dumps(headers), headers=headers)


    @app.route(ROUTE_PREFIX + "view", methods=['GET'], cors=CORS)
    def route_view():
        print("xyzzy-8:just view route")
        print(ROUTE_PREFIX)
        print(ROUTE_PREFIX_EXPLICIT)
        default_env = os.environ.get("ENV_NAME", DEFAULT_ENV)
        redirect_path = ROUTE_PREFIX_EXPLICIT + 'view/' + default_env
        print(redirect_path)
        headers = {"Location": redirect_path}
        return Response(status_code=302, body=json.dumps(headers), headers=headers)


    @app.route(ROUTE_PREFIX + 'introspect', methods=['GET'], cors=CORS)
    def introspect(environ):
        """
        Test route
        """
        auth = app_utils.singleton().check_authorization(app.current_request.to_dict(), environ)
        if auth:
            return Response(status_code=200, body=json.dumps(app.current_request.to_dict()))
        else:
            return app_utils.singleton().forbidden_response()


    @app.route(ROUTE_PREFIX + 'view_run/{environ}/{check}/{method}', methods=['GET'], cors=CORS)
    def view_run_route(environ, check, method):
        """
        Protected route
        """
        print("XYZZY: view_run_route")
        req_dict = app.current_request.to_dict()
        print(req_dict)
        domain, context = app_utils.singleton().get_domain_and_context(req_dict)
        query_params = req_dict.get('query_params', {})
        if app_utils.singleton().check_authorization(req_dict, environ):
            print(f"XYZZY: view_run_route A({method})")
            print(check)
            if method == 'action':
                print("XYZZY: view_run_route B")
                return app_utils.singleton().view_run_action(environ, check, query_params, context)
            else:
                print("XYZZY: view_run_route C")
                print(environ)
                print(check)
                print(query_params)
                print(context)
                return app_utils.singleton().view_run_check(environ, check, query_params, context)
        else:
            print("XYZZY: view_run_route D")
            return app_utils.singleton().forbidden_response(context)

    @app.route(ROUTE_PREFIX + 'view/{environ}', methods=['GET'], cors=CORS)
    def view_route(environ):
        """
        Non-protected route
        """
        print(f"xyzzy-9:view/{environ}")
        req_dict = app.current_request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(req_dict)
        return app_utils.singleton().view_foursight(app.current_request, environ, app_utils.singleton().check_authorization(req_dict, environ), domain, context)


    @app.route(ROUTE_PREFIX + 'view/{environ}/{check}/{uuid}', methods=['GET'], cors=CORS)
    def view_check_route(environ, check, uuid):
        """
        Protected route
        """
        req_dict = app.current_request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(req_dict)
        if app_utils.singleton().check_authorization(req_dict, environ):
            return app_utils.singleton().view_foursight_check(app.current_request, environ, check, uuid, True, domain, context)
        else:
            return app_utils.singleton().forbidden_response()


    @app.route(ROUTE_PREFIX + 'history/{environ}/{check}', methods=['GET'], cors=CORS)
    def history_route(environ, check):
        """
        Non-protected route
        """
        # get some query params
        req_dict = app.current_request.to_dict()
        query_params = req_dict.get('query_params')
        start = int(query_params.get('start', '0')) if query_params else 0
        limit = int(query_params.get('limit', '25')) if query_params else 25
        domain, context = app_utils.singleton().get_domain_and_context(req_dict)
        return app_utils.singleton().view_foursight_history(app.current_request, environ, check, start, limit,
                                      app_utils.singleton().check_authorization(req_dict, environ), domain, context)


    @app.route(ROUTE_PREFIX + 'checks/{environ}/{check}/{uuid}', methods=['GET'], cors=CORS)
    def get_check_with_uuid_route(environ, check, uuid):
        """
        Protected route
        """
        if app_utils.singleton().check_authorization(app.current_request.to_dict(), environ):
            return app_utils.singleton().run_get_check(environ, check, uuid)
        else:
            return app_utils.singleton().forbidden_response()


    @app.route(ROUTE_PREFIX + 'checks/{environ}/{check}', methods=['GET'], cors=CORS)
    def get_check_route(environ, check):
        """
        Protected route
        """
        if app_utils.singleton().check_authorization(app.current_request.to_dict(), environ):
            return app_utils.singleton().run_get_check(environ, check, None)
        else:
            return app_utils.singleton().forbidden_response()


    @app.route(ROUTE_PREFIX + 'checks/{environ}/{check}', methods=['PUT'], cors=CORS)
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
        if app_utils.singleton().check_authorization(request.to_dict(), environ):
            put_data = request.json_body
            return app_utils.singleton().run_put_check(environ, check, put_data)
        else:
            return app_utils.singleton().forbidden_response()


    @app.route(ROUTE_PREFIX + 'environments/{environ}', methods=['PUT'], cors=CORS)
    def put_environment(environ):
        """
        Take a PUT request that has a json payload with 'fourfront' (ff server)
        and 'es' (es server).
        Attempts to generate an new environment and runs all checks initially
        if successful.

        Protected route
        """
        request = app.current_request
        if app_utils.singleton().check_authorization(request.to_dict(), environ):
            env_data = request.json_body
            return app_utils.singleton().run_put_environment(environ, env_data)
        else:
            return app_utils.singleton().forbidden_response()


    @app.route(ROUTE_PREFIX + 'environments/{environ}', methods=['GET'], cors=CORS)
    def get_environment_route(environ):
        """
        Protected route
        """
        if app_utils.singleton().check_authorization(app.current_request.to_dict(), environ):
            return app_utils.singleton().run_get_environment(environ)
        else:
            return app_utils.singleton().forbidden_response()


    @app.route(ROUTE_PREFIX + 'environments/{environ}/delete', methods=['DELETE'], cors=CORS)
    def delete_environment(environ):
        """
        Takes a DELETE request and purges the foursight environment specified by 'environ'.
        NOTE: This only de-schedules all checks, it does NOT wipe data associated with this
        environment - that can only be done directly from S3 (for safety reasons).

        Protected route
        """
        if app_utils.singleton().check_authorization(app.current_request.to_dict(), environ):  # TODO (C4-138) Centralize authorization check
            return app_utils.singleton().run_delete_environment(environ)
        else:
            return app_utils.singleton().forbidden_response()


    # dmichaels/2022-07-31:
    # For testing/debugging/troubleshooting.
    @app.route(ROUTE_PREFIX + 'info/{environ}', methods=['GET'], cors=CORS)
    def get_view_info_route(environ):
        req_dict = app.current_request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(req_dict)
        return app_utils.singleton().view_info(request=app.current_request, environ=environ, is_admin=app_utils.singleton().check_authorization(req_dict, environ), domain=domain, context=context)


    @app.route(ROUTE_PREFIX + 'users/{environ}/{email}', cors=CORS)
    def get_view_user_route(environ, email):
        req_dict = app.current_request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(req_dict)
        return app_utils.singleton().view_user(request=app.current_request, environ=environ, is_admin=app_utils.singleton().check_authorization(req_dict, environ), domain=domain, context=context, email=email)


    @app.route(ROUTE_PREFIX + 'users/{environ}', cors=CORS)
    def get_view_users_route(environ):
        req_dict = app.current_request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(req_dict)
        return app_utils.singleton().view_users(request=app.current_request, environ=environ, is_admin=app_utils.singleton().check_authorization(req_dict, environ), domain=domain, context=context)


    ######### EXPERIMENTAL REACT API FUNCTIONS #########
    # Experimental React UI.
    @staticmethod
    def react_serve_static_file(environ, **kwargs):
        print("XYZZY11111:...................................react_serve_static_file")
        print(app_utils)
        return app_utils.singleton().react_serve_static_file(environ, **kwargs)


    @app.route(ROUTE_PREFIX + 'react', cors=CORS)
    def get_react_noenv():
        default_env = os.environ.get("ENV_NAME", DEFAULT_ENV)
        return Routes.react_serve_static_file(default_env, **{})


    @app.route(ROUTE_PREFIX + 'react/{environ}', cors=CORS)
    def get_react_0(environ):
        return Routes.react_serve_static_file(environ, **{})


    @app.route(ROUTE_PREFIX + 'react/{environ}/{path1}', cors=CORS)
    def get_react_1(environ, path1):
        return Routes.react_serve_static_file(environ, **{"path1": path1})


    @app.route(ROUTE_PREFIX + 'react/{environ}/{path1}/{path2}', cors=CORS)
    def get_react_2(environ, path1, path2):
        return Routes.react_serve_static_file(environ, **{"path1": path1, "path2": path2})


    @app.route(ROUTE_PREFIX + 'react/{environ}/{path1}/{path2}/{path3}', cors=CORS)
    def get_react_3(environ, path1, path2, path3):
        return Routes.react_serve_static_file(environ, **{"path1": path1, "path2": path2, "path3": path3})


    @app.route(ROUTE_PREFIX + 'react/{environ}/{path1}/{path2}/{path3}/{path4}', cors=CORS)
    def get_react_4(environ, path1, path2, path3, path4):
        return Routes.react_serve_static_file(environ, **{"path1": path1, "path2": path2, "path3": path3, "path4": path4})


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/users', cors=CORS)
    def react_route_get_users_route(environ):
        return app_utils.singleton().react_get_users(request=app.current_request, environ=environ)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/users/{email}', cors=CORS)
    def react_route_get_user_route(environ, email):
        return app_utils.singleton().react_get_user(request=app.current_request, environ=environ, email=email)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/info', cors=CORS)
    def react_route_get_info(environ):
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(request_dict)
        return app_utils.singleton().react_get_info(request=request, environ=environ, domain=domain, context=context)


    @app.route(ROUTE_PREFIX + 'reactapi/info', cors=CORS)
    def react_route_get_info_noenv():
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(request_dict)
        return app_utils.singleton().react_get_info(request=request, environ=None, domain=domain, context=context)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/header', methods=["GET"], cors=CORS)
    def react_route_get_header(environ):
        print('XYZZY:/REACTAPI/ENV/HEADER')
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(request_dict)
        return app_utils.singleton().react_get_header(request=request, environ=environ, domain=domain, context=context)


    @app.route(ROUTE_PREFIX + 'reactapi/header', methods=["GET"], cors=CORS)
    def react_route_get_header_noenv():
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(request_dict)
        return app_utils.singleton().react_get_header(request=request, environ=None, domain=domain, context=context)


    @app.route(ROUTE_PREFIX + 'reactapi/__clearcache__', cors=CORS)
    def react_route_clear_cache(environ):
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(request_dict)
        is_admin = app_utils.singleton().check_authorization(request_dict, environ)
        return app_utils.singleton().react_clear_cache(request=request, environ=environ, is_admin=is_admin, domain=domain, context=context)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/gac/{environ_compare}', cors=CORS)
    def react_compare_gacs(environ, environ_compare):
        print("XYZZY:/reactapi/ENVIRON/gac/ENVIRON_COMPARE")
        request = app.current_request
        request_dict = request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(request_dict)
        is_admin = app_utils.singleton().check_authorization(request_dict, environ)
        return app_utils.singleton().react_compare_gacs(request=request, environ=environ, environ_compare=environ_compare, is_admin=is_admin, domain=domain, context=context)


    @app.route(ROUTE_PREFIX + 'reactapi/reloadlambda', methods=['GET'], cors=CORS)
    def get_view_reload_lambda_route():
        print("XYZZY:/reactapi/reloadlambda!")
        req_dict = app.current_request.to_dict()
        domain, context = app_utils.singleton().get_domain_and_context(req_dict)
        default_env = os.environ.get("ENV_NAME", DEFAULT_ENV)
        return app_utils.singleton().view_reload_lambda(request=app.current_request, environ=default_env, is_admin=True, lambda_name='default', domain=domain, context=context)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checksraw', methods=['GET'], cors=CORS)
    def reactapi_route_checks_raw(environ: str):
        print(f"XYZZY:/reactapi/{environ}/checksraw")
        return app_utils.singleton().react_route_raw_checks(request=app.current_request, env=environ)

    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checksregistry', methods=['GET'], cors=CORS)
    def reactapi_route_checks_registry(environ: str):
        print(f"XYZZY:/reactapi/{environ}/checksregistry")
        return app_utils.singleton().react_route_checks_registry(request=app.current_request, env=environ)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks', methods=['GET'], cors=CORS)
    def reactapi_route_checks_grouped(environ: str):
        print(f"XYZZY:/reactapi/{environ}/checks/grouped")
        return app_utils.singleton().react_route_checks_grouped(request=app.current_request, env=environ)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks/{check}', methods=['GET'], cors=CORS)
    def reactapi_route_check_results(environ: str, check: str):
        print(f"XYZZY:/reactapi/{environ}/checks/{check}")
        return app_utils.singleton().react_route_check_results(request=app.current_request, env=environ, check=check)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks/{check}/history', methods=['GET'], cors=CORS)
    def reactapi_route_check_history(environ: str, check: str):
        print(f"XYZZY:/reactapi/{environ}/checks/{check}/history")
        params = app.current_request.to_dict().get('query_params')
        offset = int(params.get('offset', '0')) if params else 0
        limit = int(params.get('limit', '25')) if params else 25
        return app_utils.singleton().react_route_check_history(request=app.current_request, env=environ, check=check, offset=offset, limit=limit)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/checks/{check}/run', methods=['GET'], cors=CORS)
    def reactapi_route_check_run(environ: str, check: str):
        print(f"XYZZY:/reactapi/{environ}/checks/{check}/run")
        args = app.current_request.to_dict().get('query_params', {})
        print(f"XYZZY:reactapi_route_check_run:")
        print(args)
        args = args.get('args')
        print(args)
        return app_utils.singleton().reactapi_route_check_run(request=app.current_request, env=environ, check=check, args=args)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/lambdas', methods=['GET'], cors=CORS)
    def reactapi_route_lambdas(environ: str):
        print(f"XYZZY:/reactapi/{environ}/lambdas")
        return app_utils.singleton().reactapi_route_lambdas(request=app.current_request, env=environ)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/aws/s3/buckets', methods=['GET'], cors=CORS)
    def reactapi_route_aws_s3_buckets(environ: str):
        """
        Return the list of all AWS S3 bucket names for the current AWS environment.
        """
        print(f"XYZZY:/reactapi/{environ}/aws/s3/buckets")
        return app_utils.singleton().reactapi_route_aws_s3_buckets(request=app.current_request, env=environ)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/aws/s3/buckets/{bucket}', methods=['GET'], cors=CORS)
    def reactapi_route_aws_s3_bucket_keys(environ: str, bucket: str):
        """
        Return the list of AWS S3 bucket key names in the given bucket for the current AWS environment.
        """
        print(f"XYZZY:/reactapi/{environ}/aws/s3/buckets/{bucket}")
        return app_utils.singleton().reactapi_route_aws_s3_bucket_keys(request=app.current_request, env=environ, bucket=bucket)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/aws/s3/buckets/{bucket}/{key}', methods=['GET'], cors=CORS)
    def reactapi_route_aws_s3_bucket_key_content(environ: str, bucket: str, key: str):
        """
        Return the content of the given AWS S3 bucket key in the given bucket for the current AWS environment.
        """
        print(f"XYZZY:/reactapi/{environ}/aws/s3/buckets/{bucket}/{key}")
        return app_utils.singleton().reactapi_route_aws_s3_bucket_key_content(request=app.current_request, env=environ, bucket=bucket, key=key)


    @app.route(ROUTE_PREFIX + 'reactapi/{environ}/logout', methods=['GET'], cors=CORS)
    def reactapi_route_get_logout(environ):
        #
        # The environ on strictly required for logout (as we logout from all envs) but useful for redirect back.
        #
        print(f"XYZZY:/reactapi/logout")
        return app_utils.singleton().reactapi_route_get_logout(request=app.current_request, environ=environ)
