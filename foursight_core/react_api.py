from chalice import Response
import os
import io
from os.path import dirname
import jwt
import boto3
import datetime
import ast
import copy
import pkg_resources
import platform
import pytz
import requests
import re
import socket
import sys
import time
import types
import logging
from itertools import chain
from dateutil import tz
from dcicutils import ff_utils
from dcicutils.env_utils import (
    EnvUtils,
    get_foursight_bucket,
    get_foursight_bucket_prefix,
    infer_foursight_from_env,
    full_env_name,
    public_env_name,
    short_env_name,
)
from dcicutils.lang_utils import disjoined_list
from dcicutils.misc_utils import get_error_message
from dcicutils.obfuscation_utils import obfuscate_dict
from dcicutils.secrets_utils import (get_identity_name, get_identity_secrets)
from typing import Optional
from .s3_connection import S3Connection
from .fs_connection import FSConnection
from .check_utils import CheckHandler
from .sqs_utils import SQS
from .stage import Stage




class ReactApi:

    # TODO
    # Better authorization needed,
    # For now client (React) just send its JWT token we gave it on login,
    # and we decode it here and sanity check it. Better than nothing.
    def authorize(self, request_dict, environ) -> bool:
        try:
            authorization_token = request_dict.get('headers', {}).get('authorization')
            print('xyzzy:authorization_token')
            print(authorization_token)
            jwt_token = self.decrypt(authorization_token)
            print('xyzzy:jwt_token')
            print(jwt_token)
            auth0_client_id = self.get_auth0_client_id(environ)
            auth0_secret = self.get_auth0_secret(environ)
            jwt_decoded = jwt.decode(jwt_token, auth0_secret, audience=auth0_client_id, leeway=30)
            print('jwt_decoded')
            print(jwt_decoded)
            aud = jwt_decoded.get("aud")
            if aud != auth0_client_id:
                print('xyzzy:auth:return False')
                print(aud)
                print(auth0_client_id)
                return False
            print('xyzzy:auth:return True')
            return True
        except Exception as e:
            print('xyzzy:auth:error')
            print(e)
            return False

    def react_serve_file(self, environ, is_admin=False, domain="", context="/", **kwargs):

        #xyzzy
        if False and not is_admin:
            redirect_path = context + environ + "/login/"
            print(f'React redirecting to: {redirect_path}')
            response_headers = {'Location': redirect_path}
            response = Response(status_code=302, body=json.dumps(response_headers), headers=response_headers)
            return response
        #xyzzy

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
            if (environ.endswith(".html") or environ.endswith(".json")
               or environ.endswith(".map") or environ.endswith(".txt")
               or environ.endswith(".png") or environ.endswith(".ico")):
                # If the 'environ' appears to refer to a file then we take this
                # to mean the file in the main React directory. Note that this
                # means 'environ' may be a value ending in the above suffixes.
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
        elif file.endswith(".svg"):
            content_type = "image/svg+xml"
            open_mode = "r"
        elif file.endswith(".ico"):
            content_type = "image/x-icon"
            open_mode = "rb"
        else:
            file = os.path.join(BASE_DIR, REACT_BASE_DIR, REACT_DEFAULT_FILE)
            content_type = "text/html"
            open_mode = "r"
        response = Response("Experimental React UI")
        response.headers = {"Content-Type": content_type}
        print(f"Serving React file: {file} (content-type: {content_type}).")
        with io.open(file, open_mode) as f:
            try:
                response.body = f.read()
                print(f"Served React file: {file} (content-type: {content_type}).")
            except Exception as e:
                print(f"ERROR: Exception on serving React file: {file} (content-type: {content_type}).")
                print(e)
        response.status_code = 200
        return self.process_response(response)

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

    react_info_cache = {}

    def is_known_environment_name(self, env_name: str) -> bool:
        env_name = env_name.upper()
        unique_annotated_environment_names = self.get_unique_annotated_environments()
        for environment_name in unique_annotated_environment_names:
            if environment_name["name"].upper() == env_name:
                return True
            if environment_name["short"].upper() == env_name:
                return True
            if environment_name["full"].upper() == env_name:
                return True
            if environment_name["public"].upper() == env_name:
                return True
            if environment_name["foursight"].upper() == env_name:
                return True
        return False

    # TODO: Not protecte for now. TODO: make this protected and make a non-protecte one that just returns env name info for React header.
    # Experimental React UI (API) stuff.
    def react_get_info(self, request, environ, is_admin=False, domain="", context="/"):
        # TODO: Do some kind of caching for speed, but probably on individual data items which may take
        # time rather than this whole thing, or if we do do this whole thing needs to at least be on a per
        # environment basis, and need to take into account invalidating (at least) login stuff on logout etc.
        #
        # Not ready for this yet - caching user stuff which is not appropriate for the server.
        # Need an endipont to cach just stuff we need for the UI header.
#       react_env_info_cache = self.react_info_cache.get(environ)
#       if react_env_info_cache:
#           react_env_info_cache["page"]["loaded"] = self.get_load_time()
#           return react_env_info_cache
        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        login = self.get_logged_in_user_info(environ, request_dict)
        login["admin"] = is_admin
        login["auth0"] = self.get_auth0_client_id(environ)
        if self.user_record:
            login["user"] = self.user_record
        if not self.is_known_environment_name(environ):
            env_unknown = True
        else:
            env_unknown = False
        if not env_unknown:
            try:
                environment_and_bucket_info = self.sorted_dict(obfuscate_dict(self.environment.get_environment_and_bucket_info(environ, stage_name))),
                portal_url = self.get_portal_url(environ)
            except:
                environment_and_bucket_info = None
                portal_url = None
        else:
            environment_and_bucket_info = None
            portal_url = None
        response = Response('react_get_info')
        response.body = {
            "app": {
                "package": self.APP_PACKAGE_NAME,
                "stage": stage_name,
                "env": environ,
                "version": self.get_app_version(),
                "local": self.is_running_locally(request_dict),
                "credentials": self.react_get_credentials_info(environ),
                "launched": self.init_load_time,
                "deployed": self.get_lambda_last_modified()
            },
            "page": {
                "title": self.html_main_title,
                "favicon": self.get_favicon(),
                "domain": domain,
                "context": context,
                "path": request_dict.get("context").get("path"),
                "endpoint": request.path,
                "loaded": self.get_load_time()
            },
            "versions": {
                "foursight": self.get_app_version(),
                "foursight_core": pkg_resources.get_distribution('foursight-core').version,
                "dcicutils": pkg_resources.get_distribution('dcicutils').version,
                "python": platform.python_version()
            },
            "login": login,
            "server": {
                "foursight": socket.gethostname(),
                "portal": portal_url,
                "es": self.host,
                "rds": os.environ["RDS_HOSTNAME"],
                "sqs": self.sqs.get_sqs_queue().url
            },
            "env": {
                "name": environ,
                "full_name": full_env_name(environ),
                "short_name": short_env_name(environ),
                "public_name": public_env_name(environ),
                "foursight_name": infer_foursight_from_env(envname=environ),
                "default": os.environ.get("ENV_NAME"),
                "gac_name": self.get_gac_name(environ)
            },
            "envs": {
                "all": sorted(self.environment.list_environment_names()),
                "unique": sorted(self.environment.list_unique_environment_names()),
                "unique_annotated": self.get_unique_annotated_environments() # xyzzy
            },
            "buckets": {
                "env": self.environment.get_env_bucket_name(),
                "foursight": get_foursight_bucket(envname=environ, stage=stage_name),
                "foursight_prefix": get_foursight_bucket_prefix(),
                "info": environment_and_bucket_info,
                "ecosystem": self.sorted_dict(EnvUtils.declared_data()),
            },
            "checks": {
                "running": 0,
                "queued": 0
            },
            "gac": {
                "name": get_identity_name(),
                "values": self.sorted_dict(obfuscate_dict(get_identity_secrets())),
             },
            "environ": self.sorted_dict(obfuscate_dict(dict(os.environ)))
        }
        if env_unknown:
            response.body["env_unknown"] = True
        print(f'xyzzy: react_get_info: 2: {datetime.datetime.utcnow()}')
        response.headers = {'Content-Type': 'application/json'}
        response.status_code = 200
        print(f'xyzzy: react_get_info: 3: {datetime.datetime.utcnow()}')
#       self.react_info_cache[environ] = response.body
        return self.process_response(response)

    def react_get_users(self, request, environ, is_admin=False, domain="", context="/"):
        print('XYZZY:CHECK-AUTHORIZED')
        if not self.authorize(request.to_dict(), environ):
            print('XYZZY:NOT-AUTHORIZED')
            return self.forbidden_response()
        print('XYZZY:AUTHORIZED')
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

    def react_get_user(self, request, environ, is_admin=False, domain="", context="/", email=None):
        print('XYZZY:CHECK-AUTHORIZED')
        if not self.authorize(request.to_dict(), environ):
            print('XYZZY:NOT-AUTHORIZED')
            return self.forbidden_response()
        print('XYZZY:AUTHORIZED')
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
        self.react_info_cache = {}

    # NEW ...
    react_header_info_cache = {}
    def react_get_header_info(self, request, environ, domain="", context="/"):
        react_header_info_cache = self.react_header_info_cache.get(environ)
        print('xyzzy-cache-hit-yesno')
        print(react_header_info_cache)
        if react_header_info_cache:
            print('xyzzy-cache-hit')
            return react_header_info_cache
        else:
            print('xyzzy-cache-hit-no')
        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        if not self.is_known_environment_name(environ):
            env_unknown = True
        else:
            env_unknown = False
        if not env_unknown:
            try:
                environment_and_bucket_info = self.sorted_dict(obfuscate_dict(self.environment.get_environment_and_bucket_info(environ, stage_name))),
            except:
                environment_and_bucket_info = None
        else:
            environment_and_bucket_info = None
        response = Response('react_get_header_info')
        response.body = {
            "app": {
                "package": self.APP_PACKAGE_NAME,
                "stage": stage_name,
                "env": environ,
                "version": self.get_app_version(),
                "domain": domain,
                "local": self.is_running_locally(request_dict),
                "credentials": self.react_get_credentials_info(environ),
                "launched": self.init_load_time,
                "deployed": self.get_lambda_last_modified()
            },
            "page": {
                "title": self.html_main_title,
                "favicon": self.get_favicon(),
                "context": context
            },
            "versions": {
                "foursight": self.get_app_version(),
                "foursight_core": pkg_resources.get_distribution('foursight-core').version,
                "dcicutils": pkg_resources.get_distribution('dcicutils').version,
                "python": platform.python_version()
            },
            "env": {
                "name": environ,
                "full_name": full_env_name(environ),
                "short_name": short_env_name(environ),
                "public_name": public_env_name(environ),
                "foursight_name": infer_foursight_from_env(envname=environ),
                "default": os.environ.get("ENV_NAME"),
            },
            "envs": {
                "all": sorted(self.environment.list_environment_names()),
                "unique": sorted(self.environment.list_unique_environment_names()),
                "unique_annotated": self.get_unique_annotated_environments() # xyzzy
            },
            "buckets": {
                "env": self.environment.get_env_bucket_name(),
                "foursight": get_foursight_bucket(envname=environ, stage=stage_name),
                "foursight_prefix": get_foursight_bucket_prefix(),
                "info": environment_and_bucket_info,
                "ecosystem": self.sorted_dict(EnvUtils.declared_data()),
            }
        }
        if env_unknown:
            response.body["env"]["unknown"] = True
            response.body["env_unknown"] = True
        print(f'xyzzy: react_get_info: 2: {datetime.datetime.utcnow()}')
        response.headers = {
            "Content-Type": "application/json"
        }     
        print("xyzzy:headers:")
        print(response.headers)
        response.status_code = 200
        print(f'xyzzy: react_get_info: 3: {datetime.datetime.utcnow()}')
        response = self.process_response(response)
        self.react_header_info_cache[environ] = response
        return response

    def get_secrets_names(self) -> list:
        try:
            boto_secrets_manager = boto3.client('secretsmanager')
            return [secrets['Name'] for secrets in boto_secrets_manager.list_secrets()['SecretList']]
        except Exception as e:
            print("XYZZY:EXCEPTION GETTING SECRETS")
            print(e)

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
        print('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
        envs = self.get_unique_annotated_environment_names()
        print('11111xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
        print(envs)
        for env in envs:
            print('313333xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
            env["gac_name"] = self.get_gac_name(env["full"])
        return envs
