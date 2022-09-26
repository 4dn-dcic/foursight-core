from chalice import Response, __version__ as chalice_version
import base64
import cron_descriptor
import os
import io
from os.path import dirname
import jwt
import boto3
import datetime
import ast
import copy
from http.cookies import SimpleCookie
import json
import pkg_resources
import platform
import pytz
import requests
import re
import socket
import sys
import time
import types
import urllib.parse
import uuid
import logging
from itertools import chain
from dateutil import tz
from dcicutils.diff_utils import DiffManager
from dcicutils.env_utils import (
    EnvUtils,
    get_foursight_bucket,
    get_foursight_bucket_prefix,
    infer_foursight_from_env,
    full_env_name,
    public_env_name,
    short_env_name,
)
from dcicutils import ff_utils
from dcicutils.lang_utils import disjoined_list
from dcicutils.misc_utils import get_error_message, override_environ
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.secrets_utils import (get_identity_name, get_identity_secrets)
from typing import Optional
from .decorators import Decorators
from .s3_connection import S3Connection
from .fs_connection import FSConnection
from .check_utils import CheckHandler
from .sqs_utils import SQS
from .stage import Stage
from .encryption import Encryption


class ReactApi:

    class Cache:
        static_files = {}
        header = {}
        checks = None
        lambdas = None

    def create_standard_response(self, label: str, content_type: str = "application/json"):
        response = Response(label)
        response.headers = { "Content-Type": content_type }     
        response.status_code = 200
        return response

    def is_fourfront(self):
        return "Fourfront" in self.html_main_title.lower()

    def encode(self, s: str) -> str:
        return base64.b64encode(bytes(s, "utf-8")).decode("utf-8")

    def decode(self, s: str) -> str:
        return base64.b64decode(s).decode("utf-8")

    def is_allowed_env(self, env: str, allowed_envs: list) -> bool:
        if not env or not allowed_envs:
            return False
        for allowed_env in allowed_envs:
            if self.is_same_env(env, allowed_env):
                return True
        return False

    def is_local_faux_logged_in(self, request: dict) -> bool:
        """
        Returns True if and only if: this request is a LOCAL (localhost) requests AND it
        contains a cookie (set by the React UI) indicating that the user is faux logged in.
        This is supported just in case there are issues with local Auth0 authentication/login.

        N.B. If this returns True then it will entirely short-circuit the authorization check
        for the protected React API endpoint (see the authorization function below).
        So be careful with this.
        """
        if not self.is_running_locally(request):
            return False
        if self.read_cookie("test_mode_login_localhost", request) != "1":
            return False
        return True

    def reconstitute_authtoken(self, authtoken: str, env: str) -> dict:
        """
        Fully reconstitute the given encrypted/encoded authtoken (cookie).
        It contains the JWT token and a list of environments the authenticated
        is allowed to access. Returns this info fully decrypted in a dictionary.
        """
        if not authtoken:
            return None

        authtoken_decrypted = self.encryption.decrypt(authtoken)
        if not authtoken_decrypted:
            return None

        authtoken_json = json.loads(authtoken_decrypted)
        jwt_token = authtoken_json.get("jwt")
        jwt_decoded = self.decode_jwt_token(jwt_token, env)

        allowed_envs_encoded = authtoken_json.get("env")
        allowed_envs = self.encryption.decode(allowed_envs_encoded)
        allowed_envs_json = json.loads(allowed_envs) if allowed_envs else []

        return {
            "jwt": jwt_decoded,
            "jwt_token": jwt_token,
            "allowed_envs": allowed_envs_json,
            "first_name": authtoken_json.get("first_name"),
            "last_name": authtoken_json.get("last_name")
        }

    # TODO: This needs massive cleanup after messing with WRT React.
    def auth0_react_finish_callback(self, request, env, domain, jwt_token, jwt_expires):

        react_redir_url = self.read_cookie("reactredir", request)
        if react_redir_url:
            # Not certain if by design but the React library (universal-cookie) used to
            # write cookies URL-encodes them; rolling with it for now and URL-decoding here.
            react_redir_url = urllib.parse.unquote(react_redir_url)
            response_headers = {"Location": react_redir_url}

        jwt_token_decoded = self.decode_jwt_token(jwt_token, env)
        email = jwt_token_decoded.get("email")
        (known_envs, allowed_envs, first_name, last_name) = self.get_envs(email)
        authtoken = self.create_authtoken(jwt_token, allowed_envs, first_name, last_name, env)
        authtoken_cookie = self.create_set_cookie_string(request, name="authtoken",
                                                                  value=authtoken,
                                                                  domain=domain,
                                                                  expires=jwt_expires,
                                                                  http_only=True)
        #
        # Need to create an authenvs cookie too, not HttpOnly, readable by client (React UI);
        # this contains the list of known and allowed (for this authenticate user) environments.
        #
        authenvs = {
            "allowed_envs": allowed_envs,
            "default_env": self.get_default_env(),
            "known_envs": known_envs
        }
        authenvs = self.encryption.encode(authenvs)
        authenvs_cookie = self.create_set_cookie_string(request, name="authenvs",
                                                                 value=authenvs,
                                                                 domain=domain,
                                                                 expires=jwt_expires)
        response_headers["set-cookie"] = authtoken_cookie
        response_headers["Set-Cookie"] = authenvs_cookie

        return Response(status_code=302, body=json.dumps(response_headers), headers=response_headers)

    def authorize(self, request, env) -> dict:
        """
        If the request indicates that is is authenticated then returns a
        dictionary with relevant authentication/authorization info, otherwise
        returns an dictonary indicating authentication/authorization failure.
        """
        if not request:
            return { "authenticated": False, "status": "no-request" }
        if not isinstance(request, dict):
            request = request.to_dict();
        if self.is_running_locally(request):
            #
            # If running locally (localhost) AND if this is request indicates that the user is
            # faux logged in then we bypass authentication altogether and return authenticated response.
            #
            if self.is_local_faux_logged_in(request):
                return { "authenticated": True, "user": "faux" }
        try:

            test_mode_not_authorized = self.read_cookie("test_mode_not_authorized", request)
            if test_mode_not_authorized == "1":
                return { "authenticated": False, "status": "test-mode-not-authorized" }

            authtoken_encrypted = self.read_cookie("authtoken", request)
            if not authtoken_encrypted:
                return { "authenticated": False, "status": "no-authtoken" }

            authtoken_info = self.reconstitute_authtoken(authtoken_encrypted, env)
            if not authtoken_info:
                return { "authenticated": False, "status": "bad-authtoken" }

            jwt = authtoken_info["jwt"]
            if not jwt:
                return { "authenticated": False, "status": "no-jwt" }

            jwt_expires_time_t = jwt.get("exp")
            current_time_t = int(time.time())
            if jwt_expires_time_t <= current_time_t:
                return { "authenticated": False, "status": "jwt-expired" }

            allowed_envs = authtoken_info.get("allowed_envs")
            if not allowed_envs:
                return { "authenticated": False, "status": "no-allowed-envs" }
            if not self.is_allowed_env(env, allowed_envs):
                return { "authenticated": False, "status": "not-allowed-env" }

            # Sanity check the decrypted authtoken be comparing our known Auth0 client ID
            # with the ("sub" field of the) JWT from the Auth0 authentication process.

            if jwt.get("aud") != self.get_auth0_client_id(env):
                return { "authenticated": False, "status": "authtoken-mismatch" }

            # Return the raw JWT token as well as most of its info unpacked in a nicer form for UI usage.
            # We leave the issued-at and expires-at info as time_t based values (for now at least).

            authtoken_info["authenticated"] = True
            authtoken_info["authenticated_at"] = jwt.get("iat")
            authtoken_info["authenticated_until"] = jwt_expires_time_t
            authtoken_info["user"] = jwt.get("email")
            authtoken_info["user_verified"] = jwt.get("email_verified")
            return authtoken_info

        except Exception as e:
            print(e)
            return { "authenticated": False, "status": "exception", "exception": str(e) }

    def react_forbidden_response(self, body):
        response = self.create_standard_response("react_forbidden_response")
        if not body or not isinstance(body, dict):
            body = { "forbidden": true }
        response.body = body
        response.status_code = 403
        return self.process_response(response)

    def react_serve_static_file(self, environ, is_admin=False, domain="", context="/", **kwargs):

        # TODO: Maybe cache output. But if so provide backdoor way of invalidating cache.

        print(f"Serve React file called with: environ={environ}, is_admin={is_admin}")
        environ = environ.replace("{environ}", environ)

        BASE_DIR = os.path.dirname(__file__)
        REACT_BASE_DIR = "react"
        REACT_DEFAULT_FILE = "index.html"

        if environ == "static":
            # If the environ is 'static' then we take this to mean the 'static'
            # sub-directory; this is the directory where the static (js, css, etc)
            # React files live. Note that this means 'environ' may be 'static'.
            file = os.path.join(BASE_DIR, REACT_BASE_DIR, "static")
        else:
            file = os.path.join(BASE_DIR, REACT_BASE_DIR)
        args = kwargs.values()
        if not args:
            # TODO: png not downloading right!
            # Running chalice local it works though.
            # Actually it also works in cgap-supertest:
            # https://810xasmho0.execute-api.us-east-1.amazonaws.com/api/react/logo192.png
            # But not in 4dn/foursight-development:
            # https://cm3dqx36s7.execute-api.us-east-1.amazonaws.com/api/react/logo192.png
            # The correct one has: content-length: 7132
            # The incorrect one has: content-length: 5347
            # The file itself (oddly) is 5347.
            if (environ.endswith(".html") or environ.endswith(".json")
               or environ.endswith(".map") or environ.endswith(".txt")
               or environ.endswith(".png") or environ.endswith(".ico")):
                # If the 'environ' appears to refer to a file then we take this
                # to mean the file in the main React directory. Note that this
                # means 'environ' may NOT be a value ending in the above suffixes.
                args = [environ]
        for path in args:
            file = os.path.join(file, path)
        if file.endswith(".html"):
            content_type = "text/html"
            open_mode = "r"
        elif file.endswith(".js"):
            content_type = "text/javascript"
            open_mode = "r"
        elif file.endswith(".css"):
            content_type = "application/css"
            open_mode = "r"
        elif file.endswith(".json") or file.endswith(".map"):
            content_type = "application/json"
            open_mode = "r"
        elif file.endswith(".png"):
            content_type = "image/png"
            open_mode = "rb"
        elif file.endswith(".jpeg") or file.endswith(".jpg"):
            content_type = "image/jpeg"
            open_mode = "rb"
        elif file.endswith(".svg"):
            content_type = "image/svg+xml"
            open_mode = "r"
        elif file.endswith(".ico"):
            content_type = "image/x-icon"
            open_mode = "rb"
        elif file.endswith(".woff"):
            content_type = "application/octet-stream"
            open_mode = "rb"
        else:
            file = os.path.join(BASE_DIR, REACT_BASE_DIR, REACT_DEFAULT_FILE)
            content_type = "text/html"
            open_mode = "r"

        if not ReactApi.Cache.static_files.get(file):
            response = self.create_standard_response("react_serve_static_file", content_type)
            print(f"Serving React file: {file} (content-type: {content_type}).")
            with io.open(file, open_mode) as f:
                try:
                    response.body = f.read()
                    print(f"Served React file: {file} (content-type: {content_type}).")
                except Exception as e:
                    print(f"ERROR: Exception on serving React file: {file} (content-type: {content_type}).")
                    print(e)
            response = self.process_response(response)
            ReactApi.Cache.static_files[file] = response
        return ReactApi.Cache.static_files.get(file)

    # TODO: Refactor.
    def react_get_credentials_info(self, env_name: str) -> dict:
        try:
            session = boto3.session.Session()
            credentials = session.get_credentials()
            access_key_id = credentials.access_key
            region_name = session.region_name
            caller_identity = boto3.client("sts").get_caller_identity()
            user_arn = caller_identity["Arn"]
            account_number = caller_identity["Account"]
            auth0_client_id = self.get_auth0_client_id(env_name)
            return {
                "aws_account_number": account_number,
                "aws_user_arn": user_arn,
                "aws_access_key_id": access_key_id,
                "aws_region": region_name,
                "auth0_client_id": auth0_client_id
            }
        except Exception as e:
            self.note_non_fatal_error_for_ui_info(e, 'get_obfuscated_credentials_info')
            return {}

    def is_known_environment_name(self, env_name: str) -> bool:
        if not env_name:
            return False
        env_name = env_name.upper()
        unique_annotated_environment_names = self.get_unique_annotated_environments()
        for environment_name in unique_annotated_environment_names:
            if environment_name["name"].upper() == env_name:
                return True
            if environment_name["short_name"].upper() == env_name:
                return True
            if environment_name["full_name"].upper() == env_name:
                return True
            if environment_name["public_name"].upper() == env_name:
                return True
            if environment_name["foursight_name"].upper() == env_name:
                return True
        return False

    def react_get_info(self, request, environ, domain="", context="/"):

        # TODO: Put this in a decorator.
        authorize_response = self.authorize(request.to_dict(), environ)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        default_env = self.get_default_env()
        if not self.is_known_environment_name(environ):
            env_unknown = True
        else:
            env_unknown = False
        if not env_unknown:
            try:
                environment_and_bucket_info = self.sort_dictionary_by_lowercase_keys(obfuscate_dict(self.environment.get_environment_and_bucket_info(environ, stage_name))),
                portal_url = self.get_portal_url(environ)
            except:
                environment_and_bucket_info = None
                portal_url = None
        else:
            environment_and_bucket_info = None
            portal_url = None
        response = Response('react_get_info')
        response.body = {
            "page": {
                "path": request_dict.get("context").get("path"),
                "endpoint": request.path,
                "loaded": self.get_load_time()
            },
            "server": {
                "foursight": socket.gethostname(),
                "portal": portal_url,
                "es": self.host,
                "rds": os.environ["RDS_HOSTNAME"],
                "sqs": self.sqs.get_sqs_queue().url
            },
            "buckets": {
                "env": self.environment.get_env_bucket_name(),
                "foursight": get_foursight_bucket(envname=environ if environ else default_env, stage=stage_name),
                "foursight_prefix": get_foursight_bucket_prefix(),
                "info": environment_and_bucket_info,
                "ecosystem": self.sort_dictionary_by_lowercase_keys(EnvUtils.declared_data()),
            },
            "checks": {
                "running": 0,
                "queued": 0
            },
            "gac": {
                "name": get_identity_name(),
                "values": self.sort_dictionary_by_lowercase_keys(obfuscate_dict(get_identity_secrets())),
             },
            "environ": self.sort_dictionary_by_lowercase_keys(obfuscate_dict(dict(os.environ)))
        }
#       if env_unknown:
#           response.body["env"] = {
#               "name": environ,
#               "unknown": True,
#               "default": default_env
#           }
#       else:
#           response.body["env"] = {
#               "name": environ,
#               "full_name": full_env_name(environ),
#               "short_name": short_env_name(environ),
#               "public_name": public_env_name(environ),
#               "foursight_name": infer_foursight_from_env(envname=environ),
#               "default": default_env,
#               "gac_name": self.get_gac_name(environ)
#           }
        response.headers = {'Content-Type': 'application/json'}
        response.status_code = 200
        return self.process_response(response)

    def react_get_users(self, request, environ):

        authorize_response = self.authorize(request.to_dict(), environ)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        users = []
        # TODO: Support paging.
        user_records = ff_utils.get_metadata('users/', ff_env=full_env_name(environ), add_on='frame=object&limit=10000')
        for user_record in user_records["@graph"]:
            last_modified = user_record.get("last_modified")
            if last_modified:
                last_modified = last_modified.get("date_modified")
            # TODO
            # roles = []
            # project_roles = user_record.get("project_roles")
            # if project_roles:
            #     role = role.get("date_modified")
            #     roles.append({
            #         "groups": groups,
            #         "project_roles": project_roles,
            #         "principals_view": principals_view,
            #         "principals_edit": principals_edit
            #     })
            users.append({
                "email_address": user_record.get("email"),
                "first_name": user_record.get("first_name"),
                "last_name": user_record.get("last_name"),
                "uuid": user_record.get("uuid"),
                "modified": self.convert_utc_datetime_to_useastern_datetime(last_modified)})
        response = Response('react_get_users')
        response.body = sorted(users, key=lambda key: key["email_address"])
        response.headers = {'Content-Type': 'application/json'}
        response.status_code = 200
        return self.process_response(response)

    def react_get_user(self, request, environ, email=None):
        authorize_response = self.authorize(request.to_dict(), environ)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)
        users = []
        for email_address in email.split(","):
            try:
                user = ff_utils.get_metadata('users/' + email_address.lower(),
                                             ff_env=full_env_name(environ), add_on='frame=object')
                users.append({"email_address": email_address, "record": user})
            except Exception as e:
                users.append({"email_address": email_address, "record": {"error": str(e)}})
        response = Response('react_get_user')
        response.body = sorted(users, key=lambda key: key["email_address"])
        response.headers = {'Content-Type': 'application/json'}
        response.status_code = 200
        return self.process_response(response)

    def react_clear_cache(self, request, environ, is_admin=False, domain="", context="/"):
        pass

    def react_get_header(self, request, environ, domain="", context="/"):
        # Note that this route is not protected but/and we return the results from authorize.
        auth = self.authorize(request, environ)
        data = ReactApi.Cache.header.get(environ)
        if not data:
            data = self.react_get_header_nocache(request, environ, domain, context)
            ReactApi.Cache.header[environ] = data
        data = copy.deepcopy(data)
        data["auth"] = auth
        response = self.create_standard_response("react_get_header")
        response.body = data
        return self.process_response(response)

    react_header_info_cache = {}
    def react_get_header_nocache(self, request, environ, domain="", context="/"):
        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        default_env = self.get_default_env()
        response = {
            "app": {
                "title": self.html_main_title,
                "package": self.APP_PACKAGE_NAME,
                "stage": stage_name,
                "version": self.get_app_version(),
                "domain": domain,
                "context": context,
                "local": self.is_running_locally(request_dict),
                "credentials": self.react_get_credentials_info(environ if environ else default_env),
                "launched": self.init_load_time,
                "deployed": self.get_lambda_last_modified()
            },
            "versions": {
                "foursight": self.get_app_version(),
                "foursight_core": pkg_resources.get_distribution('foursight-core').version,
                "dcicutils": pkg_resources.get_distribution('dcicutils').version,
                "python": platform.python_version(),
                "chalice": chalice_version
            },
            "known_envs": self.get_unique_annotated_environments(),
            "default_env": default_env
        }

        hack_for_local_testing = False
        if hack_for_local_testing:
            response["known_envs"] = [{
            "name": "supertest",
            "short_name": "supertest",
            "full_name": "supertest",
            "public_name": "supertest",
            "foursight_name": "supertest",
            }, {
            "name": "cgap-supertest",
            "short_name": "cgap-supertest",
            "full_name": "cgap-supertest",
            "public_name": "cgap-supertest",
            "foursight_name": "cgap-supertest",
            "gac_name": "C4DatastoreCgapSupertestApplicationConfiguration"
            } ]
            response["default_env"] = "cgap-supertest"
        return response

    def get_secrets_names(self) -> list:
        try:
            boto_secrets_manager = boto3.client('secretsmanager')
            return [secrets['Name'] for secrets in boto_secrets_manager.list_secrets()['SecretList']]
        except Exception as e:
            print("Exception getting secrets")
            print(e)
            return []

    def get_gac_names(self) -> list:
        secrets_names = self.get_secrets_names()
        return [secret_name for secret_name in secrets_names if re.match('.*App(lication)?Config(uration)?.*', secret_name, re.IGNORECASE)]

    def get_gac_name(self, env_name: str) -> str:
        gac_names = self.get_gac_names()
        env_name_short = short_env_name(env_name)
        pattern = re.compile(".*" + env_name_short.replace('-', '.*').replace('_', '.*') + ".*", re.IGNORECASE)
        matching_gac_names = [gac_name for gac_name in gac_names if pattern.match(gac_name)]
        if len(matching_gac_names):
            return matching_gac_names[0]
        else:
            return " OR ".join(matching_gac_names)

    def get_unique_annotated_environments(self):
        envs = self.get_unique_annotated_environment_names()
        for env in envs:
            env["gac_name"] = self.get_gac_name(env["full_name"])
        return envs

    def react_compare_gacs(self, request, environ, environ_compare, is_admin=False, domain="", context="/"):
        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        response = Response('react_compare_gacs')
        response.body = self.compare_gacs(environ, environ_compare)
        response.headers = {
            "Content-Type": "application/json"
        }     
        response.status_code = 200
        response = self.process_response(response)
        return response

    def compare_gacs(self, env_name_a: str, env_name_b: str) -> dict:
        gac_name_a = self.get_gac_name(env_name_a)
        gac_name_b = self.get_gac_name(env_name_b)
        with override_environ(IDENTITY=gac_name_a):
            gac_values_a = get_identity_secrets()
        with override_environ(IDENTITY=gac_name_b):
            gac_values_b = get_identity_secrets()
        diff = DiffManager(label=None)
        diffs = diff.diffs(gac_values_a, gac_values_b)
        return {
            "gac": self.sort_dictionary_by_lowercase_keys(obfuscate_dict(gac_values_a)),
            "gac_compare": self.sort_dictionary_by_lowercase_keys(obfuscate_dict(gac_values_b)),
            "gac_diffs": diffs
        }

    def is_same_env(self, env_a: str, env_b: str) -> bool:
        if not env_a or not env_b:
            return False
        env_b = env_b.lower()
        full_env_a = full_env_name(env_a) or ""
        short_env_a = short_env_name(env_a) or ""
        public_env_a = public_env_name(env_a) or ""
        foursight_env_a = infer_foursight_from_env(envname=env_a) or ""
        return (env_a.lower() == env_b
            or  full_env_a.lower() == env_b
            or  short_env_a.lower() == env_b
            or  public_env_a.lower() == env_b
            or  foursight_env_a.lower() == env_b)

    def filter_checks_by_env(self, checks: dict, env) -> dict:
        if not env:
            return checks
        checks_for_env = {}
        for check_key in checks:
            if checks[check_key]["schedule"]:
                for check_schedule_key in checks[check_key]["schedule"].keys():
                    for check_env_key in checks[check_key]["schedule"][check_schedule_key].keys():
                        if check_env_key == "all" or self.is_same_env(check_env_key, env):
                            checks_for_env[check_key] = checks[check_key]
            else:
                # If no schedule section (which has the env section) then include it.
                checks_for_env[check_key] = checks[check_key]
        return checks_for_env

    def get_checks_raw(self):
        return self.check_handler.CHECK_SETUP

    def get_checks(self, env: str):
        print("xyzzy:get_checks......................................")
        if not ReactApi.Cache.checks:
            checks = self.get_checks_raw()
            for check_key in checks.keys():
                print("xyzzy:get_checks:")
                print(check_key)
                print(checks[check_key])
                print(checks[check_key]["group"])
                checks[check_key]["name"] = check_key
                checks[check_key]["group"] = checks[check_key]["group"]
            lambdas = self.get_annotated_lambdas()
            self.annotate_checks_with_schedules_from_lambdas(checks, lambdas)
            self.annotate_checks_with_kwargs_from_decorators(checks)
            ReactApi.Cache.checks = checks
        xyzzy = self.filter_checks_by_env(ReactApi.Cache.checks, env)
        print('xyzzy..................................................................................')
        print(xyzzy)
        return xyzzy

    def get_checks_grouped(self, env: str) -> None:
        checks_groups = []
        checks = self.get_checks(env)
        for check_setup_item_name in checks:
            check_setup_item = checks[check_setup_item_name]
            check_setup_item_group = check_setup_item["group"]
            # TODO: Probably a nore pythonic way to do this.
            found = False
            for grouped_check in checks_groups:
                if grouped_check["group"] == check_setup_item_group:
                    grouped_check["checks"].append(check_setup_item)
                    found = True
                    break
            if not found:
                checks_groups.append({ "group": check_setup_item_group, "checks": [check_setup_item]})
        return checks_groups

    def get_checks_grouped_by_schedule(self, env: str) -> None:
        checks_grouped_by_schedule = []
        checks = self.get_checks(env)
        # TODO
        return checks_grouped_by_schedule

    def get_check(self, env: str, check: str):
        checks = self.get_checks(env)
        for check_key in checks.keys():
            if check_key == check:
                return checks[check_key]
        return check

    def get_stack_name(self):
        return os.environ.get("STACK_NAME")

    def get_stack_template(self, stack_name: str = None) -> dict:
        if not stack_name:
            stack_name = self.get_stack_name()
            if not stack_name:
                return {}
        boto_cloudformation = boto3.client('cloudformation')
        return boto_cloudformation.get_template(StackName=stack_name)
 
    def get_lambdas_from_template(self, stack_template: dict) -> dict:
        lambda_definitions = []
        stack_template = stack_template["TemplateBody"]["Resources"]
        for resource_key in stack_template:
            resource_type = stack_template[resource_key]["Type"]
            if resource_type == "AWS::Lambda::Function":
                lambda_name = resource_key
                lambda_properties = stack_template[lambda_name]["Properties"]
                lambda_code_s3_bucket = lambda_properties["Code"]["S3Bucket"]
                lambda_code_s3_bucket_key = lambda_properties["Code"]["S3Key"]
                lambda_handler = lambda_properties["Handler"]
                lambda_definitions.append({
                    "lambda_name": lambda_name,
                    "lambda_code_s3_bucket": lambda_code_s3_bucket,
                    "lambda_code_s3_bucket_key": lambda_code_s3_bucket_key,
                    "lambda_handler": lambda_handler
                })
        return lambda_definitions

    def annotate_lambdas_with_schedules_from_template(self, lambdas: dict, stack_template: dict) -> list:
        stack_template = stack_template["TemplateBody"]["Resources"]
        for resource_key in stack_template:
            resource_type = stack_template[resource_key]["Type"]
            if resource_type == "AWS::Events::Rule":
                event_name = resource_key
                event_properties = stack_template[event_name]["Properties"]
                event_schedule = event_properties["ScheduleExpression"]
                if event_schedule:
                    event_targets = event_properties["Targets"]
                    for event_target in event_targets:
                        event_target = dict(event_target)
                        event_target_arn = dict(event_target["Arn"])
                        event_target_function_arn = event_target_arn["Fn::GetAtt"]
                        if len(event_target_function_arn) == 2 and "Arn" in event_target_function_arn:
                            if event_target_function_arn[0] == "Arn":
                                event_target_function_name = event_target_function_arn[1]
                            else:
                                event_target_function_name = event_target_function_arn[0]
                            if event_target_function_name:
                                for la in lambdas:
                                    if la["lambda_name"] == event_target_function_name:
                                        event_schedule = str(event_schedule).replace("cron(", "").replace(")", "")
                                        la["lambda_schedule"] = str(event_schedule)
                                        cron_description = cron_descriptor.get_description(str(event_schedule))
                                        if cron_description.startswith("At "):
                                            cron_description = cron_description[3:]
                                        la["lambda_schedule_description"] = cron_description

        return lambdas

    def annotate_lambdas_with_function_metadata(self, lambdas: dict) -> list:
        boto_lambda = boto3.client("lambda")
        lambda_functions = boto_lambda.list_functions()["Functions"]
        for lambda_function in lambda_functions:
            lambda_function_handler = lambda_function["Handler"]
            for la in lambdas:
                if la["lambda_handler"] == lambda_function_handler:
                    la["lambda_function_name"] = lambda_function["FunctionName"]
                    la["lambda_function_arn"] = lambda_function["FunctionArn"]
                    la["lambda_code_size"] = lambda_function["CodeSize"]
                    la["lambda_modified"] = lambda_function["LastModified"]
                    la["lambda_description"] = lambda_function["Description"]
                    la["lambda_role"] = lambda_function["Role"]
                    #
                    # Look for the real modified time which may be in the tag if we ever did a manual
                    # reload of the lambda which will do its job by making an innocuous change to the
                    # lambda (its description) but which also has the effect of changing its modified
                    # time, so that process also squirrels away the real lambda modified time in a
                    # tag called last_modified. See the reload_lambda function for details of this.
                    try:
                       lambda_function_tags = boto_lambda.list_tags(Resource=lambda_function["FunctionArn"])["Tags"]
                       lambda_modified = lambda_function_tags.get("last_modified")
                       if lambda_modified:
                            la["lambda_modified"] = lambda_modified
                    except:
                        pass
        return lambdas

    def annotate_lambdas_with_check_setup(self, lambdas: dict, checks: dict) -> dict:
        if not checks or not isinstance(checks, dict):
            return lambdas
        for check_setup_item_name in checks:
            check_setup_item = checks[check_setup_item_name]
            check_setup_item_schedule = check_setup_item.get("schedule")
            if check_setup_item_schedule:
                for check_setup_item_schedule_name in check_setup_item_schedule.keys():
                    for la in lambdas:
                        if la["lambda_handler"] == check_setup_item_schedule_name or la["lambda_handler"] == "app." + check_setup_item_schedule_name:
                            if not la.get("lambda_checks"):
                                la["lambda_checks"] = [check_setup_item_schedule_name]
                            elif check_setup_item_schedule_name not in la["lambda_checks"]:
                                la["lambda_checks"].append(check_setup_item_schedule_name)
        return lambdas

    def get_annotated_lambdas(self) -> dict:
        if not ReactApi.Cache.lambdas:
            stack_name = self.get_stack_name()
            stack_template = self.get_stack_template(stack_name)
            lambdas = self.get_lambdas_from_template(stack_template)
            lambdas = self.annotate_lambdas_with_schedules_from_template(lambdas, stack_template)
            lambdas = self.annotate_lambdas_with_function_metadata(lambdas)
            lambdas = self.annotate_lambdas_with_check_setup(lambdas, self.get_checks_raw())
            ReactApi.Cache.lambdas = lambdas
        return ReactApi.Cache.lambdas

    def annotate_checks_with_schedules_from_lambdas(self, checks: dict, lambdas: dict) -> None:
        for check_setup_item_name in checks:
            check_setup_item = checks[check_setup_item_name]
            check_setup_item_schedule = check_setup_item.get("schedule")
            if check_setup_item_schedule:
                for check_setup_item_schedule_name in check_setup_item_schedule.keys():
                    for la in lambdas:
                        if la["lambda_handler"] == check_setup_item_schedule_name or la["lambda_handler"] == "app." + check_setup_item_schedule_name:
                            check_setup_item_schedule[check_setup_item_schedule_name]["cron"] = la["lambda_schedule"]
                            check_setup_item_schedule[check_setup_item_schedule_name]["cron_description"] = la["lambda_schedule_description"]

    def annotate_checks_with_kwargs_from_decorators(self, checks: dict) -> None:
        checks_decorators = Decorators.get_registry()
        for check_setup_item_name in checks:
            check_setup_item = checks[check_setup_item_name]
            for checks_decorator in checks_decorators:
                checks_decorator_function_name = checks_decorator.get("function")
                if check_setup_item_name == checks_decorator_function_name:
                    checks_decorator_kwargs = checks_decorator.get("kwargs")
                    if checks_decorator_kwargs:
                        check_setup_item["registered_kwargs"] = checks_decorator_kwargs


    def react_route_checks_raw(self, request, env: str) -> dict:

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("react_route_checks")
        response.body = self.get_checks_raw()
        response = self.process_response(response)
        return response

    def react_route_checks_registry(self, request, env: str) -> dict:

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("react_route_checks_grouped")
        response.body = Decorators.get_registry()
        response = self.process_response(response)
        return response

    def react_route_checks_grouped(self, request, env: str) -> dict:

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("react_route_checks_grouped")
        response.body = self.get_checks_grouped(env)
        response = self.process_response(response)
        return response

    def react_route_check_history(self, request, env: str, check: str, offset: int = 0, limit: int = 25, sort: str = None) -> dict:

        if offset < 0:
            offset = 0
        if limit < 0:
            limit = 0
        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("react_route_check_history")
        check_record = self.get_check(env, check)
        connection = self.init_connection(env)
        history, total = self.get_foursight_history(connection, check, offset, limit, sort)
        history_kwargs = list(set(chain.from_iterable([item[2] for item in history])))
        queue_attr = self.sqs.get_sqs_attributes(self.sqs.get_sqs_queue().url)
        running_checks = queue_attr.get('ApproximateNumberOfMessagesNotVisible')
        queued_checks = queue_attr.get('ApproximateNumberOfMessages')
        for item in history:
            for subitem in item:
                if isinstance(subitem, dict):
                    uuid = subitem.get("uuid")
                    if uuid:
                        timestamp = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
                        timestamp = self.convert_utc_datetime_to_useastern_datetime(timestamp)
                        subitem["timestamp"] = timestamp
        history = {
            "check": check_record,
            "env": env,
            "history_kwargs": history_kwargs,
            "paging": {
                "total": total,
                "count": len(history),
                "limit": min(limit, total),
                "offset": min(offset, total),
                "more": max(total - offset - limit, 0)
            },
            "list": history
        }
        response.body = history
        response = self.process_response(response)
        return response

    def react_route_checks_status(self, request, env: str) -> dict:

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("react_route_checks_status")
        checks_queue = self.sqs.get_sqs_attributes(self.sqs.get_sqs_queue().url)
        checks_running = checks_queue.get('ApproximateNumberOfMessagesNotVisible')
        checks_queued = checks_queue.get('ApproximateNumberOfMessages')
        response.body = {
            "checks_running": checks_running,
            "checks_queued": checks_queued
        }
        return self.process_response(response)

    def reactapi_route_lambdas(self, request, env: str) -> dict:

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("reactapi_route_lambdas")
        response.body = self.get_annotated_lambdas()
        response = self.process_response(response)
        return response

    def react_route_check_results(self, request, env: str, check: str) -> dict:

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("react_route_check_results")
        try:
            connection = self.init_connection(env)
            check_results = self.CheckResult(connection, check)
            #check_results = check_results.get_closest_result()
            check_results = check_results.get_latest_result()
            uuid = check_results["uuid"]
            check_datetime = datetime.datetime.strptime(uuid, "%Y-%m-%dT%H:%M:%S.%f")
            check_datetime = self.convert_utc_datetime_to_useastern_datetime(check_datetime)
            check_results["timestamp"] = check_datetime
            response.body = check_results
        except Exception as e:
            response.body = {}
        return self.process_response(response)

    def reactapi_route_check_run(self, request, env: str, check: str, args: str):
        # TODO: What is this primary thing for? It is an option on the old/existing UI.
        response = self.create_standard_response("reactapi_route_check_run")
        args = self.encryption.decode(args)
        args = json.loads(args)
        queued_uuid = self.queue_check(env, check, args)
        #params = {"primary": True}
        #queued_uuid = self.queue_check(env, check, params)
        response.body = {"check": check, "env": env, "uuid": queued_uuid}
        return self.process_response(response)

    def reactapi_route_get_logout(self, request, environ) -> dict:
        request_dict = request.to_dict()
        domain, context = self.get_domain_and_context(request_dict)
        redirect_url = self.read_cookie("reactredir", request_dict)
        if not redirect_url:
            http = "https" if not self.is_running_locally(request_dict) else "http"
            redirect_url = f"{http}://{domain}{context if context else ''}react/{environ}/login"
        else:
            # Not certain if by design but the React library (universal-cookie) used to
            # write cookies URL-encodes them; rolling with it for now and URL-decoding here.
            redirect_url = urllib.parse.unquote(redirect_url)
        authtoken_cookie_deletion = self.create_delete_cookie_string(request_dict, "authtoken", domain)
        headers = {
            "location": redirect_url,
            "set-cookie": authtoken_cookie_deletion
        }
        return Response(status_code=302, body=json.dumps(headers), headers=headers)

    def get_buckets(self) -> list:
        results = []
        try:
            s3 = boto3.resource("s3")
            results = sorted([bucket.name for bucket in s3.buckets.all()])
        except Exception as e:
            print("Get buckets error: " + str(e))
            pass
        return results

    def get_bucket_keys(self, bucket_name: str) -> list:
        results = []
        try:
            s3 = boto3.client("s3")
            bucket_keys = s3.list_objects(Bucket=bucket_name)
            if bucket_keys:
                bucket_keys = bucket_keys.get("Contents")
                if bucket_keys:
                    for bucket_key in sorted(bucket_keys, key=lambda item: item["Key"]):
                        results.append({
                            "key": bucket_key["Key"],
                            "size": bucket_key["Size"],
                            "modified": self.convert_utc_datetime_to_useastern_datetime(bucket_key["LastModified"])
                        })

        except Exception as e:
            print("Get bucket keys error: " + str(e))
        return results

    def get_bucket_key_contents(self, bucket_name: str, bucket_key_name) -> list:
        try:
            s3 = boto3.resource("s3")
            s3_object = s3.Object(bucket_name, bucket_key_name)
            return s3_object.get()["Body"].read().decode("utf-8")
        except Exception as e:
            print("Get bucket key contents error: " + str(e))

    def reactapi_route_aws_s3_buckets(self, request, env: str):

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("reactapi_route_aws_s3_buckets")
        response.body = self.get_buckets()
        return self.process_response(response)

    def reactapi_route_aws_s3_bucket_keys(self, request, env: str, bucket: str):

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        response = self.create_standard_response("reactapi_route_aws_s3_buckets")
        response.body = self.get_bucket_keys(bucket)
        return self.process_response(response)

    def reactapi_route_aws_s3_bucket_key_content(self, request, env: str, bucket: str, key: str):

        authorize_response = self.authorize(request, env)
        if not authorize_response or not authorize_response["authenticated"]:
            return self.react_forbidden_response(authorize_response)

        key = urllib.parse.unquote(key)
        response = self.create_standard_response("reactapi_route_aws_s3_bucket_key_content")
        response.body = self.get_bucket_key_contents(bucket, key)
        return self.process_response(response)
