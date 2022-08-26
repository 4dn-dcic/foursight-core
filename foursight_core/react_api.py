from chalice import Response
import jinja2
import json
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
                "aws_account_number:": account_number,
                "aws_user_arn:": user_arn,
                "aws_access_key_id:": access_key_id,
                "aws_region:": region_name,
                "auth0_client_id": auth0_client_id
            }
        except Exception as e:
            self.note_non_fatal_error_for_ui_info(e, 'get_obfuscated_credentials_info')
            return {}

    react_info_cache = {}

    # Experimental React UI (API) stuff.
    def react_get_info(self, request, environ, is_admin=False, domain="", context="/"):
        # TODO: Do some kind of caching for speed, but probably on individual data items which may take
        # time rather than this whole thing, or if we do do this whole thing needs to at least be on a per
        # environment basis, and need to take into account invalidating (at least) login stuff on logout etc.
        react_env_info_cache = self.react_info_cache.get(environ)
        if react_env_info_cache:
            return react_env_info_cache
        print(f'xyzzy: react_get_info: 0: {datetime.datetime.utcnow()}')
        request_dict = request.to_dict()
        stage_name = self.stage.get_stage()
        login = self.get_logged_in_user_info(environ, request_dict)
        login["admin"] = is_admin
        login["auth0"] = self.get_auth0_client_id(environ)
        if self.user_record:
            login["user"] = self.user_record
        # xyzzy = self.get_unique_annotated_environment_names()
        # xyzzy.append({"name":"foo-bar-suptest", "full":"foo-bar-suptestful", "short":"sfafdfa-short", "inferred":"iadfad-nf"})
        response = Response('react_get_info')
        print(f'xyzzy: react_get_info: 1: {datetime.datetime.utcnow()}')
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
                "portal": self.get_portal_url(environ),
                "es": self.host,
                "rds": os.environ["RDS_HOSTNAME"],
                "sqs": self.sqs.get_sqs_queue().url
            },
            "env": {
                "name": environ,
                "full_name": full_env_name(environ),
                "short_name": short_env_name(environ),
                "inferred_name": infer_foursight_from_env(envname=environ),
            },
            "envs": {
                "all": sorted(self.environment.list_environment_names()),
                "unique": sorted(self.environment.list_unique_environment_names()),
                "unique_annotated": self.get_unique_annotated_environment_names() # xyzzy
            },
            "buckets": {
                "env": self.environment.get_env_bucket_name(),
                "foursight": get_foursight_bucket(envname=environ, stage=stage_name),
                "foursight_prefix": get_foursight_bucket_prefix(),
                "info": self.sorted_dict(obfuscate_dict(self.environment.get_environment_and_bucket_info(environ, stage_name))),
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
        print(f'xyzzy: react_get_info: 2: {datetime.datetime.utcnow()}')
        response.headers = {'Content-Type': 'application/json'}
        response.status_code = 200
        print(f'xyzzy: react_get_info: 3: {datetime.datetime.utcnow()}')
        self.react_info_cache[environ] = response.body
        return self.process_response(response)

    def react_get_users(self, request, environ, is_admin=False, domain="", context="/"):
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
